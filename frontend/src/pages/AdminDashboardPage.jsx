import { money } from '../services/memberships.js';
import { Link } from 'react-router-dom';
import useAdminDashboard from '../hooks/useAdminDashboard.js';
import Icon from '../components/Icon.jsx';

const number = new Intl.NumberFormat('en');
const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
function Metric({ label, value, detail, icon }) {
  return <article className="dashboard-metric"><div><span>{label}</span><Icon name={icon} /></div><strong>{number.format(value)}</strong><p>{detail}</p></article>;
}
function FuturePanel({ title, description, icon }) {
  return <section className="dashboard-panel future-panel"><div className="panel-heading"><h2>{title}</h2><Icon name={icon} /></div><span className="dashboard-badge">Coming soon</span><p>{description}</p></section>;
}
export default function AdminDashboardPage() {
  const { data, loading, error, refresh } = useAdminDashboard();
  const max = data ? Math.max(1, ...data.registrations.map(item => item.count)) : 1;
  const total = data?.registrations.reduce((sum, item) => sum + item.count, 0) || 0;
  return <div className="admin-dashboard">
    <div className="dashboard-heading"><div className="page-heading"><p className="eyebrow">YOUR COMMUNITY AT A GLANCE</p><h1 tabIndex="-1">Admin dashboard.</h1><p>A clearer view of the people moving with you.</p></div><button className="secondary-button" onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh dashboard'}</button></div>
    {error && <div className="dashboard-alert" role="alert"><strong>Could not update the dashboard.</strong><p>{error}{data ? ' Showing the last successful snapshot.' : ''}</p><button onClick={refresh} disabled={loading}>Try again</button></div>}
    {loading && !data && <div className="loading-panel" role="status"><span className="spinner" />Loading dashboard…</div>}
    {data && <div aria-busy={loading}>
      <p className="dashboard-updated">Updated {new Date(data.generatedAt).toLocaleString('en', { timeZone: 'UTC' })} UTC · Account data</p>
      <div className="dashboard-metrics">
        <Metric label="Total members" value={data.summary.totalMembers} detail="All registered member accounts" icon="user" />
        <Metric label="Active accounts" value={data.summary.activeMemberAccounts} detail="Enabled members, not paid memberships" icon="check" />
        <Metric label="Trainers" value={data.summary.totalTrainers} detail={`${number.format(data.summary.activeTrainers)} active trainer accounts`} icon="shield" />
        <Metric label="New this month" value={data.summary.newMembersThisMonth} detail="Member registrations · UTC" icon="arrow" />
      </div>
      <div className="dashboard-charts">
        <section className="dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">COMMUNITY GROWTH</p><h2>Member registrations</h2></div><span className="dashboard-badge">Last 6 months</span></div><p className="chart-summary"><strong>{number.format(total)}</strong> registrations in this period</p>
          <figure className="registration-chart"><figcaption className="chart-caption">Monthly registrations in UTC; the current month is partial.</figcaption><div className="chart-bars">{data.registrations.map(item => <div className="chart-column" key={item.month}><span className="bar-value">{number.format(item.count)}</span><div className="bar-track" aria-hidden="true"><div style={{ height: `${item.count / max * 100}%` }} /></div><span>{new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString('en', { month: 'short', year: '2-digit', timeZone: 'UTC' })}</span></div>)}</div></figure>
          {total === 0 && <p className="dashboard-empty">No member registrations in this period. New accounts will appear here automatically.</p>}
        </section>
        <section className="dashboard-panel account-breakdown"><p className="eyebrow">ACCOUNT HEALTH</p><h2>Member account status</h2><p>Account access across your community.</p><div className="status-track" aria-hidden="true"><span style={{ width: `${data.summary.totalMembers ? data.summary.activeMemberAccounts / data.summary.totalMembers * 100 : 0}%` }} /></div><dl><div><dt><i className="status-dot" />Active</dt><dd>{number.format(data.summary.activeMemberAccounts)}</dd></div><div><dt><i className="status-dot inactive" />Inactive</dt><dd>{number.format(data.summary.inactiveMemberAccounts)}</dd></div></dl><p className="dashboard-note">Account access is separate from membership coverage below.</p></section>
      </div>
      <section className="dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">LATEST ARRIVALS</p><h2>Recent members</h2></div><span className="dashboard-badge">Latest 5</span></div>
        {data.recentMembers.length ? <div className="dashboard-table-scroll" tabIndex="0" role="region" aria-label="Recent members table"><table className="dashboard-table"><caption>Most recently registered member accounts</caption><thead><tr><th scope="col">Member</th><th scope="col">Joined (UTC)</th><th scope="col">Account status</th></tr></thead><tbody>{data.recentMembers.map(member => <tr key={member.id}><td><strong>{member.name}</strong><span>{member.email}</span></td><td>{date.format(new Date(member.createdAt))}</td><td><span className={`account-status ${member.active ? '' : 'disabled'}`}>{member.active ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table></div> : <p className="dashboard-empty">No members yet. Registered members will appear here.</p>}
      </section>
      <div className="dashboard-future"><section className="dashboard-panel account-breakdown"><h2>Membership coverage</h2><dl><div><dt>Active</dt><dd>{data.modules.memberships.active}</dd></div><div><dt>Scheduled</dt><dd>{data.modules.memberships.scheduled}</dd></div><div><dt>Expired</dt><dd>{data.modules.memberships.expired}</dd></div></dl><p className="dashboard-note">Current member accounts with coverage records, including inactive accounts. Archived accounts excluded. Coverage is not proof of payment.</p></section><section className="dashboard-panel"><h2>Simulated revenue</h2><p><strong>{money(data.modules.payments.totalMinor)}</strong> all time</p><p><strong>{money(data.modules.payments.monthMinor)}</strong> this month (UTC)</p><p className="dashboard-note">Demo payments only · No real money collected · Includes retained history for inactive and archived members.</p><h3>Recent demo payments</h3>{data.modules.payments.recent.length ? <ul>{data.modules.payments.recent.map(payment => <li key={payment.id}>{payment.memberName} · {money(payment.amountMinor)} · {payment.status}</li>)}</ul> : <p>No demo payments yet.</p>}<Link to="/admin/payments">Open payments →</Link></section><section className="dashboard-panel"><h2>Attendance</h2><p><strong>{data.modules.attendance.today}</strong> check-ins today</p><p><strong>{data.modules.attendance.month}</strong> check-ins this month</p><p className="dashboard-note">Recorded visits · UTC · Includes retained history for inactive and archived members.</p><Link to="/admin/attendance/report">Open attendance report →</Link></section><section className="dashboard-panel"><h2>Upcoming sessions</h2>{data.modules.sessions.upcoming.length ? <ul>{data.modules.sessions.upcoming.map(session => <li key={session.id}><strong>{session.memberName} with {session.trainerName}</strong><p>{new Date(session.startAt).toLocaleString('en-GB', { timeZone: session.timezone })} · {session.timezone}</p></li>)}</ul> : <p>No upcoming sessions.</p>}<Link to="/admin/sessions">Open schedule →</Link></section></div>
    </div>}
  </div>;
}

