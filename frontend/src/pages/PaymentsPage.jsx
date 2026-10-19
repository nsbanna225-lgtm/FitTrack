import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import useResource from '../hooks/useResource.js';
import api from '../services/api.js';
import { money, calendarDate } from '../services/memberships.js';
import { errorMessage } from '../utils/auth.js';
import MemberDialog from '../components/MemberDialog.jsx';

function PeriodPicker({ admin, memberId, busy, open }) {
  const { data, loading, error, refresh } = useResource(admin ? `/memberships/members/${memberId}` : '/memberships/me');
  return <section className="member-panel"><h2>Enrollment & renewal payments</h2>
    <p className="member-note">Choose a saved coverage period to open its payment. Each period has one payment record. Reopening it preserves its status.</p>
    {loading && <p role="status">Loading membership periods…</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={refresh}>Try again</button></div>}
    {data && <form className="member-filters" onSubmit={event => { event.preventDefault(); open(new FormData(event.currentTarget).get('periodId')); }}>
      <label>Membership period<select name="periodId" required disabled={busy || !data.membership.history.length}>{!data.membership.history.length && <option value="">No enrollment or renewal yet</option>}{data.membership.history.map(period => <option key={period.id} value={period.id}>{period.planName} · {calendarDate(period.startAt)} · {money(period.priceMinor, period.currency)}</option>)}</select></label>
      <button disabled={busy || !data.membership.history.length || !data.member.active || !!data.member.archivedAt}>Open demo payment</button>
      {(!data.member.active || data.member.archivedAt) && <p>Activate and restore the account to change payments.</p>}
    </form>}
  </section>;
}

export default function PaymentsPage() {
  const { user } = useAuth(), admin = user.role === 'admin';
  const [params, setParams] = useSearchParams();
  const { data, loading, error, refresh } = useResource(`/payments?${params}`);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [actionError, setActionError] = useState(''), [action, setAction] = useState(null);
  const memberId = admin ? params.get('memberId') : user.id;
  async function open(periodId) {
    if (busy) return;
    setBusy(true); setNotice(''); setActionError('');
    try {
      const { data: result } = await api.post('/payments', { periodId, ...(admin ? { memberId } : {}) });
      setNotice(`Demo payment ${result.payment.id} is ${result.payment.status}. No money has moved.`);
      setParams(admin ? { memberId } : {}); refresh();
    } catch (err) { setActionError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (busy) return;
    setBusy(true); setActionError('');
    try {
      const retry = action.kind === 'retry';
      await api.post(`/payments/${action.payment.id}/${retry ? 'retry' : 'simulate'}`, { expectedVersion: action.payment.version, ...(!retry ? { outcome: action.kind } : {}) });
      setNotice(retry ? 'Demo payment reset to pending.' : `Simulated payment marked ${action.kind}. No money has moved.`);
      setAction(null); refresh();
    } catch (err) { setActionError(errorMessage(err)); setAction(null); refresh(); }
    finally { setBusy(false); }
  }
  function filter(event) {
    event.preventDefault();
    setParams({ ...Object.fromEntries(new FormData(event.currentTarget)), ...(admin && memberId ? { memberId } : {}), page: '1' });
  }
  function page(value) { const next = new URLSearchParams(params); next.set('page', value); setParams(next); }
  return <div className="members-page payments-page">
    <div className="page-heading"><p className="eyebrow">MEMBERSHIP PAYMENTS</p><h1 tabIndex="-1">{admin ? 'Payment overview.' : 'Your payment history.'}</h1><p>Follow payments for each enrollment and renewal.</p></div>
    <p className="payment-demo">Demo mode · All payments and revenue are simulated. No money is collected. Membership coverage stays separate.</p>
    {notice && <p role="status" className="member-notice">{notice}</p>}{actionError && <p role="alert">{actionError}</p>}
    {(!admin || memberId) ? <PeriodPicker key={memberId} admin={admin} memberId={memberId} busy={busy} open={open} /> : <p className="member-note">Open a <Link to="/admin/members">member profile</Link> to start an enrollment or renewal payment.</p>}
    <form className="member-filters" key={params.toString()} onSubmit={filter}>
      {admin && <label>Saved member name<input name="q" maxLength={100} defaultValue={params.get('q') || ''}/></label>}
      <label>Status<select name="status" defaultValue={params.get('status') || 'all'}><option value="all">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option></select></label>
      <button>Apply filters</button><button type="button" className="secondary-button" onClick={() => setParams({})}>Reset</button>
    </form>
    {admin && memberId && <p className="member-note">Showing one member. Reset to show everyone.</p>}
    {loading && <p role="status">Loading payments…</p>}{error && <div role="alert"><p>{error}</p><button onClick={refresh}>Try again</button></div>}
    {data && <><section className="member-panel"><h2>Payment records</h2>{!data.records.length ? <p>No payment records match these filters. Open a membership period above to create a pending demo payment.</p> : data.records.map(payment => <article className="payment-record" key={payment.id}>
      <div className="payment-heading"><div><h3>{payment.planName}</h3><p>{payment.memberName} · {money(payment.amountMinor, payment.currency)}</p></div><span className={`member-status ${payment.status === 'paid' ? 'enabled' : ''}`}>{payment.status} · demo</span></div>
      <p className="member-note">Coverage: {calendarDate(payment.startAt)} – {calendarDate(new Date(new Date(payment.expiresAt).getTime() - 86400000))} (UTC, inclusive)</p>
      <p className="member-note payment-id">Payment: {payment.id}{payment.paidAt && <> · Simulated paid on {calendarDate(payment.paidAt)}</>}</p>
      <details><summary>Status history ({payment.events.length})</summary><ol>{payment.events.map((event, i) => <li key={i}>{event.status} · {new Date(event.at).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</li>)}</ol></details>
      <div className="member-actions">{payment.status === 'pending' && <><button disabled={busy} onClick={() => { setActionError(''); setAction({ payment, kind: 'paid' }); }}>Simulate success</button><button className="secondary-button" disabled={busy} onClick={() => { setActionError(''); setAction({ payment, kind: 'failed' }); }}>Simulate failure</button></>}{payment.status === 'failed' && <button disabled={busy} onClick={() => { setActionError(''); setAction({ payment, kind: 'retry' }); }}>Retry demo payment</button>}{payment.status === 'paid' && <p className="member-note">Simulation complete. This payment cannot be changed.</p>}</div>
    </article>)}</section><div className="member-pagination"><button className="secondary-button" disabled={data.pagination.page <= 1} onClick={() => page(data.pagination.page - 1)}>Previous</button><span>{data.pagination.total} records · Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}</span><button className="secondary-button" disabled={data.pagination.page >= data.pagination.pages} onClick={() => page(data.pagination.page + 1)}>Next</button></div></>}
    {action && <MemberDialog title={action.kind === 'retry' ? 'Retry this demo payment?' : `Simulate payment ${action.kind === 'paid' ? 'success' : 'failure'}?`} busy={busy} close={() => setAction(null)}><p>{action.payment.planName} · {money(action.payment.amountMinor, action.payment.currency)}</p><p>No real money will move. {action.kind === 'paid' ? 'This marks the demo payment paid permanently and includes it in simulated revenue.' : action.kind === 'failed' ? 'This marks the demo payment failed. You can retry afterward.' : 'This returns the failed payment to pending.'}</p><div className="member-actions"><button disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Confirm simulation'}</button><button className="secondary-button" disabled={busy} onClick={() => setAction(null)}>Cancel</button></div></MemberDialog>}
  </div>;
}

