import { useState } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import useResource from '../hooks/useResource.js';
import api from '../services/api.js';
import { errorMessage } from '../utils/auth.js';

export default function AttendancePage({ report = false }) {
  const { user } = useAuth();
  const admin = user.role === 'admin';
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [actionError, setActionError] = useState('');
  const { data, loading, error, refresh } = useResource(`/attendance${report ? '/report' : ''}?${params}`);
  const today = new Date().toISOString().slice(0, 10);
  async function checkIn(memberId) {
    if (busy) return;
    setBusy(true); setActionError(''); setNotice('');
    try {
      await api.post('/attendance/check-in', admin ? { memberId } : {});
      setNotice('Check-in recorded for today (UTC).'); refresh();
    } catch (err) { setActionError(errorMessage(err)); refresh(); }
    finally { setBusy(false); }
  }
  function filter(event) {
    event.preventDefault();
    setParams({ ...Object.fromEntries(new FormData(event.currentTarget)), ...(admin && params.get('memberId') ? { memberId: params.get('memberId') } : {}), page: '1' });
  }
  function page(value) { const next = new URLSearchParams(params); next.set('page', value); setParams(next); }
  return <div className="members-page attendance-page">
    <div className="member-page-heading"><div className="page-heading"><p className="eyebrow">KEEP SHOWING UP</p><h1 tabIndex="-1">{report ? 'Attendance report.' : 'Your presence matters.'}</h1><p>{admin ? 'Record visits and follow your community’s attendance.' : 'Check in when you visit and watch your consistency grow.'}</p></div>
      {!admin && <button disabled={busy || loading || !data || data.summary?.checkedInToday} onClick={() => checkIn()}>{busy ? 'Checking in…' : data?.summary?.checkedInToday ? 'Checked in today' : 'Check in today'}</button>}
    </div>
    {admin && <nav className="attendance-tabs" aria-label="Attendance sections"><NavLink end to="/admin/attendance">Check-in history</NavLink><NavLink to="/admin/attendance/report">Member report & check-in</NavLink></nav>}
    <p className="member-note">One check-in per member per UTC day. Times below use UTC. Attendance is recorded independently of sessions, workouts, and membership coverage.</p>
    {notice && <p role="status" className="member-notice">{notice}</p>}{actionError && <p role="alert">{actionError}</p>}
    <form className="member-filters" key={params.toString()} onSubmit={filter}>
      {admin && <label>Member name<input name="q" maxLength={100} defaultValue={params.get('q') || ''}/></label>}
      <label>From (UTC)<input type="date" name="from" required max={today} defaultValue={params.get('from') || `${today.slice(0, 7)}-01`}/></label>
      <label>To (UTC)<input type="date" name="to" required max={today} defaultValue={params.get('to') || today}/></label>
      <button>Apply filters</button><button type="button" className="secondary-button" onClick={() => setParams({})}>Reset</button>
    </form>
    <p className="member-note">Attendance percentage = days checked in ÷ calendar days in this period, including today and starting no earlier than registration. Rest days and days without membership coverage remain in the denominator. Select at most 366 days.</p>
    {params.get('memberId') && <p className="member-note">Filtered to one member. Reset to show everyone.</p>}
    {loading && <p role="status">Loading attendance…</p>}
    {error && <div role="alert" className="member-panel"><p>{error}</p><button onClick={refresh}>Try again</button></div>}
    {data && <>
      <p className="member-note">Showing {data.period.from} to {data.period.to} · UTC{report ? ' · Includes inactive and archived members' : ''}</p>
      {data.summary && <section className="member-panel attendance-summary"><div><p className="eyebrow">{data.summary.memberName}</p><h2>{data.summary.percentage === null ? 'No eligible days' : `${data.summary.percentage}% attendance`}</h2><p>{data.summary.attendedDays} days checked in / {data.summary.elapsedDays} calendar days</p></div><progress max="100" value={data.summary.percentage ?? 0} aria-label="Attendance percentage"/></section>}
      <section className="member-panel"><h2>{report ? 'Member attendance' : 'Check-in history'}</h2>
        {!data.records.length ? <p className="member-empty">{report ? 'No members match this period and search.' : 'No check-ins in this period.'}</p> : <div className="attendance-records">{data.records.map(record => <article className="attendance-record" key={record.id}>
          <div><h3>{report ? record.name : record.memberName}</h3>{report ? <><p>{record.percentage ?? '—'}% · {record.attendedDays} / {record.elapsedDays} days</p><progress max="100" value={record.percentage ?? 0} aria-label={`${record.name} attendance percentage`}/>{!record.active && <p className="member-note">Inactive or archived account</p>}</> : <><p><time dateTime={record.checkedInAt}>{new Date(record.checkedInAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</time></p><p className="member-note">{record.source === 'member' ? 'Member check-in' : 'Recorded by admin'}</p></>}</div>
          {report && <div className="member-actions"><Link to={`/admin/attendance?memberId=${record.id}&from=${data.period.from}&to=${data.period.to}`}>History →</Link><button className="secondary-button" disabled={busy || !record.active} onClick={() => checkIn(record.id)}>Check in today</button></div>}
        </article>)}</div>}
      </section>
      <div className="member-pagination"><button className="secondary-button" disabled={data.pagination.page <= 1} onClick={() => page(data.pagination.page - 1)}>Previous</button><span>{data.pagination.total} records · Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}</span><button className="secondary-button" disabled={data.pagination.page >= data.pagination.pages} onClick={() => page(data.pagination.page + 1)}>Next</button></div>
    </>}
  </div>;
}

