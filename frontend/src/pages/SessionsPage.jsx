import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import useResource from '../hooks/useResource.js';
import SessionForm from '../components/SessionForm.jsx';
import MemberDialog from '../components/MemberDialog.jsx';
import api from '../services/api.js';
import { errorMessage } from '../utils/auth.js';

export function sessionTime(value, timezone) {
  return new Date(value).toLocaleString('en-GB', { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' });
}
export default function SessionsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null), [action, setAction] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const { data, loading, error: loadError, refresh } = useResource(`/sessions?${params}`);
  const today = new Date().toISOString().slice(0,10);
  const endDefault = new Date(new Date(`${params.get('from') || today}T00:00:00Z`).getTime() + 30 * 86400000);
  const defaultTo = Number.isNaN(+endDefault) ? today : endDefault.toISOString().slice(0,10);
  function page(value) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next); }
  async function confirm() {
    if (busy) return; setBusy(true); setError('');
    try { await api.post(`/sessions/${action.session.id}/${action.kind}`, { expectedVersion: action.session.version }); setNotice(action.kind === 'cancel' ? 'Session cancelled. The time is available again.' : 'Session marked completed.'); setAction(null); refresh(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <div className="members-page"><div className="member-page-heading"><div className="page-heading"><p className="eyebrow">MAKE TIME FOR PROGRESS</p><h1 tabIndex="-1">{user.role === 'admin' ? 'Session schedule.' : 'Your sessions.'}</h1><p>{user.role === 'trainer' ? 'Review your bookings and record completed sessions.' : 'Find a time, book a trainer, and keep your next step in sight.'}</p></div>{user.role !== 'trainer' && <button onClick={() => setEditing({})}>Book session</button>}</div>
    {notice && <p className="member-notice" role="status">{notice}</p>}
    <form className="member-filters session-filters" key={params.toString()} onSubmit={event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); setParams({ ...values, ...(params.get('trainerId') ? { trainerId: params.get('trainerId') } : {}), ...(params.get('memberId') ? { memberId: params.get('memberId') } : {}), page: '1' }); }}>
      <label>From (UTC)<input type="date" required name="from" defaultValue={params.get('from') || today} /></label><label>Until (UTC, exclusive)<input type="date" required name="to" defaultValue={params.get('to') || defaultTo} /></label>
      <label>Status<select name="status" defaultValue={params.get('status') || 'all'}><option value="all">All statuses</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><button>Apply filters</button><button type="button" className="secondary-button" onClick={() => setParams({})}>Clear filters</button>
    </form>{(params.has('trainerId') || params.has('memberId')) && <p className="member-note">Showing one participant’s schedule. Clear filters to see all sessions.</p>}
    <div className="member-list-title"><p className="member-note">Session times use the trainer’s time zone; date filters use UTC. Past sessions remain scheduled until marked completed.</p><button className="secondary-button" disabled={loading} onClick={refresh}>Refresh schedule</button></div>
    {loading && <p role="status">Loading sessions…</p>}{loadError && <p role="alert">{loadError} <button onClick={refresh}>Retry</button></p>}
    {data && <>{!data.sessions.length && <section className="member-panel"><h2>No sessions in this view</h2><p>Try another date range or book your next session.</p></section>}<div className="session-grid">{data.sessions.map(session => <article className="member-panel session-card" key={session.id}>
      <span className={`member-status ${session.status === 'scheduled' ? 'enabled' : ''}`}>{session.status}</span><h2>{session.memberName} with {session.trainerName}</h2><p><strong>{sessionTime(session.startAt, session.timezone)}</strong><br />to {sessionTime(session.endAt, session.timezone)}<br /><span className="member-note">{session.timezone}</span></p>
      <div className="member-actions">{session.status === 'scheduled' && +new Date(session.startAt) > Date.now() && <>{user.role !== 'trainer' && <button className="secondary-button" onClick={() => setEditing(session)}>Reschedule</button>}<button className="secondary-button" onClick={() => { setError(''); setAction({ session, kind: 'cancel' }); }}>Cancel session</button></>}{session.status === 'scheduled' && +new Date(session.endAt) <= Date.now() && user.role !== 'member' && <button onClick={() => { setError(''); setAction({ session, kind: 'complete' }); }}>Mark completed</button>}</div>
    </article>)}</div><div className="member-pagination"><button className="secondary-button" disabled={data.pagination.page <= 1} onClick={() => page(data.pagination.page - 1)}>Previous</button><span>{data.pagination.total} sessions · Page {data.pagination.page} of {Math.max(1,data.pagination.pages)}</span><button className="secondary-button" disabled={data.pagination.page >= data.pagination.pages} onClick={() => page(data.pagination.page + 1)}>Next</button></div></>}
    {editing && <SessionForm session={editing.id ? editing : null} close={() => setEditing(null)} saved={() => { setNotice(editing.id ? 'Session rescheduled.' : 'Session booked. Adjust the date range if it is outside this view.'); setEditing(null); refresh(); }} />}
    {action && <MemberDialog title={action.kind === 'cancel' ? 'Cancel this session?' : 'Mark session completed?'} busy={busy} close={() => setAction(null)}><p>{action.session.memberName} with {action.session.trainerName}<br />{sessionTime(action.session.startAt, action.session.timezone)} · {action.session.timezone}</p><p>{action.kind === 'cancel' ? 'This releases the reserved time and keeps a cancelled record in the schedule.' : 'Confirm that this session took place. This is separate from attendance and payment tracking.'}</p>{error && <p role="alert">{error}</p>}<div className="member-actions"><button disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Confirm'}</button><button className="secondary-button" disabled={busy} onClick={() => setAction(null)}>Go back</button></div></MemberDialog>}
  </div>;
}

