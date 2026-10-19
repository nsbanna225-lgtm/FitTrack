import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useResource from '../hooks/useResource.js';
import { money } from '../services/memberships.js';

const metrics = { registrations: 'Member registrations', visits: 'Attendance check-ins', revenueMinor: 'Simulated revenue', scheduled: 'Scheduled sessions', completed: 'Completed sessions', cancelled: 'Cancelled sessions' };
const number = value => new Intl.NumberFormat('en').format(value);
export default function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const { data, loading, error, refresh } = useResource(`/analytics?${params}`);
  const [metric, setMetric] = useState('registrations');
  const today = new Date().toISOString().slice(0, 10);
  const filterEnd = params.get('to') || today;
  const validEnd = /^\d{4}-\d{2}-\d{2}$/.test(filterEnd) && Number.isFinite(Date.parse(filterEnd)) ? filterEnd : today;
  const defaultFrom = new Date(Math.max(Date.parse('1900-01-01'), Date.parse(validEnd) - 89 * 86400000)).toISOString().slice(0, 10);
  const format = value => metric === 'revenueMinor' ? money(value) : number(value);
  const max = Math.max(1, ...(data?.rows.map(row => row[metric]) || []));
  return <div className="admin-dashboard analytics-page">
    <div className="dashboard-heading"><div className="page-heading"><p className="eyebrow">PATTERNS OVER TIME</p><h1 tabIndex="-1">Analytics.</h1><p>Explore community growth, visits, demo revenue, and session outcomes.</p></div><button className="secondary-button" onClick={refresh} disabled={loading}>Refresh analytics</button></div>
    <form className="member-filters" key={params.toString()} onSubmit={event => { event.preventDefault(); setParams(new URLSearchParams(new FormData(event.currentTarget))); }}>
      <label>From (UTC)<input name="from" type="date" required min="1900-01-01" max={today} defaultValue={params.get('from') || defaultFrom}/></label>
      <label>To (UTC)<input name="to" type="date" required min="1900-01-01" max={today} defaultValue={params.get('to') || today}/></label>
      <label>Group by<select name="interval" defaultValue={params.get('interval') || 'month'}><option value="month">Month</option><option value="day">Day</option></select></label>
      <button disabled={loading}>Apply dates</button><button type="button" className="secondary-button" onClick={() => setParams({})}>Reset dates</button>
    </form>
    <p className="member-note">Select up to 366 days. Dates are inclusive in UTC; today's data stops at refresh time. First and last months may be partial.</p>
    {loading && <p role="status">Loading analytics…</p>}
    {error && <div role="alert" className="dashboard-alert"><p>{error}</p><button onClick={refresh}>Try again</button></div>}
    {data && <>
      <p className="dashboard-updated">{data.from} through {data.to} · Updated {new Date(data.generatedAt).toLocaleString('en', { timeZone: 'UTC' })} UTC</p>
      <div className="dashboard-metrics">{[['Registrations', number(data.totals.registrations)], ['Check-ins', number(data.totals.visits)], ['Unique visitors', number(data.totals.uniqueVisitors)], ['Simulated revenue', money(data.totals.revenueMinor)]].map(([label,value]) => <article className="dashboard-metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <section className="dashboard-panel"><div className="panel-heading"><h2>Trends</h2><label className="analytics-picker">Measure<select value={metric} onChange={event => setMetric(event.target.value)}>{Object.entries(metrics).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
        <p className="chart-summary"><strong>{format(data.totals[metric])}</strong> {metrics[metric].toLowerCase()} in this period</p>
        {!data.totals[metric] && <p className="dashboard-empty">No recorded activity for this measure in the selected period.</p>}
        <div className="analytics-bars" role="region" aria-label={`${metrics[metric]} chart, scroll for more periods`} tabIndex="0">{data.rows.map(row => <div className="analytics-row" key={row.period}><span>{row.period}</span><div className="analytics-track" aria-hidden="true"><div style={{width:`${row[metric] / max * 100}%`}}/></div><strong>{format(row[metric])}</strong></div>)}</div>
        <details><summary>View exact values for every measure</summary><div className="dashboard-table-scroll" role="region" aria-label="Analytics values" tabIndex="0"><table className="dashboard-table"><caption>UTC periods within the selected dates</caption><thead><tr><th scope="col">Period</th>{Object.values(metrics).map(label => <th scope="col" key={label}>{label}</th>)}<th scope="col">Paid demo payments</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.period}><th scope="row">{row.period}</th>{Object.keys(metrics).map(key => <td key={key}>{key === 'revenueMinor' ? money(row[key]) : number(row[key])}</td>)}<td>{row.paidPayments}</td></tr>)}</tbody></table></div></details>
      </section>
      <section className="dashboard-panel"><h2>What these numbers mean</h2><p>Registrations include retained member accounts, including inactive and archived accounts. Attendance counts recorded check-ins, with each visitor counted once in the period's unique total.</p><p>Revenue counts successful demo payments by payment date, in INR. No real money is collected. Pending and failed payments contribute zero.</p><p>Sessions are grouped by their start date and current status, including retained history. Scheduled sessions here have already started; future sessions are outside this report. Rescheduling or status changes can change past totals. Completion is a recorded status, not an attendance rate.</p><p>These totals are live readings of separate collections, not a frozen accounting snapshot. Personal fitness measurements remain in Fitness progress.</p></section>
    </>}
  </div>;
}

