import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import useResource from '../hooks/useResource.js';
import WorkoutPicker from '../components/WorkoutPicker.jsx';
import ProgressChart from '../components/ProgressChart.jsx';
import ProgressForm from '../components/ProgressForm.jsx';
import { measurements } from '../utils/progress.js';

function History({ memberId, role, params, setParams }) {
  const query = new URLSearchParams(params); query.delete('memberId');
  const { data, loading, error, refresh } = useResource(`/progress/members/${memberId}?${query}`);
  const [editing, setEditing] = useState(null), [notice, setNotice] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.parse(today) - 89 * 86400000).toISOString().slice(0, 10);
  function filter(event) { event.preventDefault(); setParams({ ...(role !== 'member' ? { memberId } : {}), ...Object.fromEntries(new FormData(event.currentTarget)), page: '1' }); }
  function page(value) { const next = new URLSearchParams(params); next.set('page', value); setParams(next); }
  return <>
    {notice && <p className="member-notice" role="status">{notice}</p>}
    <form className="member-filters" key={params.toString()} onSubmit={filter}>
      <label>From (UTC)<input name="from" type="date" min="1900-01-01" max={today} required defaultValue={params.get('from') || defaultFrom}/></label>
      <label>To (UTC)<input name="to" type="date" min="1900-01-01" max={today} required defaultValue={params.get('to') || today}/></label>
      <button>Apply dates</button><button type="button" className="secondary-button" onClick={() => setParams(role === 'member' ? {} : { memberId })}>Reset dates</button>
    </form>
    <p className="member-note">Select up to 366 days. Historical measurements may predate account registration. Summary and charts cover every entry in the selected period.</p>
    {loading && <p role="status">Loading progress…</p>}{error && <div role="alert"><p>{error}</p><button onClick={refresh}>Try again</button></div>}
    {data && <>
      <div className="member-page-heading"><h2>{data.member.name}</h2>{data.member.editable && <button onClick={() => setEditing({})}>Add progress entry</button>}</div>
      {!data.member.editable && <p className="member-note">Read-only history{role === 'trainer' ? ' for your currently assigned member.' : ': activate and restore this member to record progress.'}</p>}
      <div className="progress-summary">
        <section className="member-panel"><h3>Latest recorded weight</h3><strong>{data.summary.latest ? `${data.summary.latest.weightKg} kg` : 'No entries yet'}</strong><p>{data.summary.latest?.day || 'Add your first measurement to begin.'}</p></section>
        <section className="member-panel"><h3>Weight change</h3><strong>{data.summary.weightChangeKg === null ? 'Needs two entries' : `${data.summary.weightChangeKg > 0 ? '+' : ''}${data.summary.weightChangeKg} kg`}</strong><p>First to last entry in this period</p></section>
        <section className="member-panel"><h3>Latest entry BMI</h3><strong>{data.summary.latest?.bmi ?? 'Not recorded'}</strong><p>BMI = weight (kg) ÷ height (m)², using the height in that entry.</p></section>
      </div>
      <ProgressChart rows={data.trend}/>
      <section className="member-panel"><h2>Workout completion</h2><p><strong>{data.summary.workout.percentage === null ? 'No assigned exercises' : `${data.summary.workout.percentage}%`}</strong> · {data.summary.workout.completed} of {data.summary.workout.items} exercise entries across {data.summary.workout.assignments} assignments</p>
        <progress aria-label="Workout exercise completion" max="100" value={data.summary.workout.percentage ?? 0}/>
        <p className="member-note">Current completion of workouts assigned during the selected dates, including archived assignments. This is not a daily completion log.</p><Link to={`/${role}/workouts?status=all${role !== 'member' ? `&memberId=${memberId}` : ''}`}>View workout history →</Link>
      </section>
      <section className="member-panel"><h2>Progress history</h2>{!data.records.length ? <p>No progress entries in this period.</p> : data.records.map(row => <article className="progress-record" key={row.id}><div className="member-page-heading"><h3><time dateTime={row.day}>{row.day}</time></h3>{data.member.editable && <button className="secondary-button" onClick={() => setEditing(row)}>Edit entry for {row.day}</button>}</div>
        <dl className="progress-measurements">{measurements.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{row[key] ?? '—'}</dd></div>)}<div><dt>BMI</dt><dd>{row.bmi ?? '—'}</dd></div></dl>
        <p className="member-text">{row.notes || 'No notes recorded.'}</p><p className="member-note">Revision {row.version} · Last saved {new Date(row.updatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</p>
      </article>)}</section>
      <div className="member-pagination"><button className="secondary-button" disabled={data.pagination.page <= 1} onClick={() => page(data.pagination.page - 1)}>Previous</button><span>{data.pagination.total} entries · Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}</span><button className="secondary-button" disabled={data.pagination.page >= data.pagination.pages} onClick={() => page(data.pagination.page + 1)}>Next</button></div>
    </>}
    {editing && <ProgressForm memberId={memberId} record={editing.id ? editing : null} close={() => { setEditing(null); refresh(); }} saved={day => { setEditing(null); setNotice('Progress saved.'); const next = new URLSearchParams(params); next.set('from', new Date(Date.parse(day) - 89 * 86400000).toISOString().slice(0, 10) < '1900-01-01' ? '1900-01-01' : new Date(Date.parse(day) - 89 * 86400000).toISOString().slice(0, 10)); next.set('to', day); next.set('page', '1'); setParams(next); refresh(); }}/>}
  </>;
}
export default function ProgressPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const memberId = user.role === 'member' ? user.id : params.get('memberId');
  return <div className="members-page progress-page"><div className="page-heading"><p className="eyebrow">YOUR JOURNEY, RECORDED</p><h1 tabIndex="-1">Fitness progress.</h1><p>Track measurements, reflect on your training, and see changes over time.</p></div>
    {user.role !== 'member' && <section className="member-panel"><h2>{user.role === 'trainer' ? 'Your assigned members' : 'Choose a member'}</h2><WorkoutPicker kind="members" label="Find an active member" selected={selected} choose={member => { setSelected(member); setParams({ memberId: member.id }); }}/>{user.role === 'admin' && <p className="member-note">For inactive or archived members, open progress from their member profile.</p>}</section>}
    {memberId ? <History key={memberId} memberId={memberId} role={user.role} params={params} setParams={setParams}/> : <p className="member-note">Choose a member to view their progress history.</p>}
  </div>;
}

