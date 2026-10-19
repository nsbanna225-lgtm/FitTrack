import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import useNotifications, { notificationsChanged } from '../hooks/useNotifications.js';
import usePushNotifications from '../hooks/usePushNotifications.js';
import api from '../services/api.js';
import { errorMessage } from '../utils/auth.js';
const categories = { booking: 'Booking updates', session_reminder: 'Upcoming sessions', membership_expiry: 'Membership expiry', payment_reminder: 'Demo payments', workout_update: 'Workout updates' };

function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  useEffect(() => {
    const capture = event => { event.preventDefault(); setInstallPrompt(event); };
    const installed = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installed); };
  }, []);
  if (!installPrompt) return null;
  return <button className="secondary-button" onClick={async () => { await installPrompt.prompt(); setInstallPrompt(null); }}>Install FitTrack</button>;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, refresh } = useNotifications(`/notifications?${params}`);
  const push = usePushNotifications();
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [notice, setNotice] = useState('');
  async function mark(row) {
    if (busy) return;
    setBusy(true); setActionError(''); setNotice('');
    try {
      await api.patch(`/notifications/${row.id}/read`, { read: !row.readAt });
      setNotice(row.readAt ? 'Notification marked unread.' : 'Notification marked read.'); notificationsChanged();
    } catch (err) { setActionError(errorMessage(err)); refresh(); }
    finally { setBusy(false); }
  }
  function page(value) { const next = new URLSearchParams(params); next.set('page', value); setParams(next); }
  return <div className="members-page notifications-page"><div className="member-page-heading"><div className="page-heading"><p className="eyebrow">STAY IN THE LOOP</p><h1 tabIndex="-1">Your notifications.</h1><p>Booking updates and timely reminders, together in one place.</p></div><button className="secondary-button" disabled={loading || busy} onClick={refresh}>Refresh inbox</button></div>
    <p className="member-note">Your inbox refreshes every minute while the app is visible and when you return. Booking and workout updates cover the past 30 days. Resolved reminders and superseded updates disappear automatically.</p>
    {user.role === 'admin' && <p className="member-note">This is your personal inbox. Admin accounts do not receive member or trainer reminders; use the dashboard and management pages to oversee the gym.</p>}
    <section className="member-panel push-settings" aria-labelledby="push-settings-heading">
      <div><p className="eyebrow">PHONE SETUP</p><h2 id="push-settings-heading">FitTrack on your phone</h2><p>On iPhone, open FitTrack in Safari and use Share, then Add to Home Screen. On Android, install from your browser menu.</p></div>
      <div className="push-actions"><InstallAppButton />{push.supported && push.configured && <button className="secondary-button" disabled={push.loading} onClick={push.enabled ? push.disable : push.enable}>{push.loading ? 'Updating…' : push.enabled ? 'Disable phone notifications' : 'Enable phone notifications'}</button>}</div>
      <p className="member-note" role={push.error ? 'alert' : 'status'}>{push.error || (push.loading ? 'Checking phone notification support…' : !push.supported ? 'Phone notifications are not supported by this browser.' : !push.configured ? 'Phone notifications are not configured on this server.' : push.enabled ? 'Phone notifications are enabled for this device.' : 'Phone notifications are off for this device.')}</p>
    </section>
    <form className="member-filters" key={params.toString()} onSubmit={event => { event.preventDefault(); setParams({ ...Object.fromEntries(new FormData(event.currentTarget)), page: '1' }); }}>
      <label>Read status<select name="status" defaultValue={params.get('status') || 'all'}><option value="all">All notifications</option><option value="unread">Unread</option><option value="read">Read</option></select></label>
      <label>Category<select name="kind" defaultValue={params.get('kind') || 'all'}><option value="all">All categories</option>{Object.entries(categories).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
      <button>Apply filters</button><button type="button" className="secondary-button" onClick={() => setParams({})}>Reset filters</button>
    </form>
    {notice && <p role="status" className="member-notice">{notice}</p>}{actionError && <p role="alert">{actionError}</p>}
    {loading && <p role="status">Loading notifications…</p>}{error && <div role="alert" className="member-panel"><p>{error}</p><button onClick={refresh}>Try again</button></div>}
    {data && <><p className="member-note">{data.unread} unread across your inbox · Last refreshed {new Date(data.refreshedAt).toLocaleTimeString('en-GB')}</p>
      {!data.records.length ? <section className="member-panel"><h2>{data.unread ? 'No notifications match these filters' : 'You’re all caught up'}</h2><p>New reminders and updates will appear here when available.</p></section> : <div className="notification-list">{data.records.map(row => <article key={row.id} className={`member-panel notification-card ${row.readAt ? '' : 'is-unread'}`}>
        <div className="notification-meta"><span>{categories[row.kind]}</span><span className="member-status">{row.readAt ? 'Read' : 'Unread'}</span></div><h2>{row.title}</h2><p className="member-text">{row.message}</p><p className="member-note"><time dateTime={row.occurredAt}>{new Date(row.occurredAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</time></p>
        <div className="member-actions"><Link to={row.href}>View details →</Link><button className="secondary-button" disabled={busy} onClick={() => mark(row)}>{row.readAt ? 'Mark unread' : 'Mark read'}</button></div>
      </article>)}</div>}
      <div className="member-pagination"><button className="secondary-button" disabled={data.pagination.page <= 1 || busy} onClick={() => page(data.pagination.page - 1)}>Previous</button><span>{data.pagination.total} notifications · Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}</span><button className="secondary-button" disabled={data.pagination.page >= data.pagination.pages || busy} onClick={() => page(data.pagination.page + 1)}>Next</button></div>
    </>}
  </div>;
}

