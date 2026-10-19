import { useState } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import useResource from '../hooks/useResource.js';
import { ExerciseForm, WorkoutPlanForm, AssignWorkoutForm } from '../components/WorkoutForms.jsx';
export default function WorkoutsPage({ kind = 'assignments' }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams(), [editing, setEditing] = useState(null), [assigning, setAssigning] = useState(null), [notice, setNotice] = useState('');
  const { data, loading, error, refresh } = useResource(`/workouts/${kind}?${params}`);
  const title = kind === 'assignments' ? 'Assigned workouts.' : kind === 'plans' ? 'Workout plans.' : 'Exercise library.';
  function page(value) { const next = new URLSearchParams(params); next.set('page', value); setParams(next); }
  function filter(event) { event.preventDefault(); setParams({ ...Object.fromEntries(new FormData(event.currentTarget)), ...(params.get('memberId') && user.role !== 'member' ? { memberId: params.get('memberId') } : {}), page: '1' }); }
  function saved(message) { setEditing(null); setAssigning(null); setNotice(message); refresh(); }
  return <div className="members-page workouts-page"><div className="member-page-heading"><div className="page-heading"><p className="eyebrow">A LITTLE STRONGER, EVERY DAY</p><h1 tabIndex="-1">{title}</h1><p>{kind === 'assignments' ? 'Follow each workout day and keep track of completed exercises.' : kind === 'plans' ? 'Build reusable plans, then assign a cycle to a member.' : 'Define exercises and the instructions that go with them.'}</p></div>{kind !== 'assignments' && <button onClick={() => setEditing({})}>{kind === 'plans' ? 'Create plan' : 'Create exercise'}</button>}</div>
    {user.role !== 'member' && <nav className="workout-tabs" aria-label="Workout sections"><NavLink end to={`/${user.role}/workouts`}>Assignments</NavLink><NavLink to={`/${user.role}/workouts/plans`}>Plans</NavLink><NavLink to={`/${user.role}/workouts/exercises`}>Exercises</NavLink></nav>}
    {notice && <p role="status" className="member-notice">{notice}</p>}
    <form className="member-filters" onSubmit={filter} key={`${kind}-${params}`}><label>Search<input name="q" maxLength={100} defaultValue={params.get('q') || ''}/></label><label>Status<select name="status" defaultValue={params.get('status') || 'active'}>{(kind === 'assignments' ? ['active','completed','archived','all'] : ['active','inactive','all']).map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label><button>Apply filters</button><button type="button" className="secondary-button" onClick={() => setParams({})}>Clear filters</button></form>
    {params.get('memberId') && <p className="member-note">Showing workouts for the selected member. Clear filters to see all members.</p>}
    {loading && <p role="status">Loading workouts…</p>}{error && <div role="alert" className="member-panel"><p>{error}</p><button onClick={refresh}>Try again</button><button className="secondary-button" onClick={() => setParams({})}>Reset filters</button></div>}
    {data && <>{!data.records.length && <section className="member-panel"><h2>No {kind} to show</h2><p>{kind === 'assignments' ? 'New assignments appear here. Try another status to see completed workouts or history.' : 'Create your first entry or adjust the filters.'}</p></section>}
      <div className="workout-grid">{data.records.map(record => <article className="member-panel workout-card" key={record.id}><span className={`member-status ${record.active || record.status === 'completed' ? 'enabled' : ''}`}>{record.status || (record.active ? 'Active' : 'Inactive')}</span><h2>{record.name}</h2>
        {kind === 'assignments' ? <><p>{record.memberName} · Assigned by {record.trainerName}</p><progress value={record.completedCount} max={record.itemCount} aria-label={`${record.name} completion`}/><p>{record.completedCount} of {record.itemCount} exercises complete</p><Link className="member-link" to={`/${user.role}/workouts/assignments/${record.id}`}>Open workout →</Link></> : <><p className="member-text">{record.instructions || 'No additional instructions.'}</p>{kind === 'plans' && <p>{record.items.length} exercises · {new Set(record.items.map(row => row.day)).size} workout days</p>}<div className="member-actions"><button className="secondary-button" onClick={() => setEditing(record)}>Edit {kind === 'plans' ? 'plan' : 'exercise'}</button>{kind === 'plans' && record.active && <button onClick={() => setAssigning(record)}>Assign plan</button>}</div></>}
      </article>)}</div><div className="member-pagination"><button className="secondary-button" disabled={data.pagination.page <= 1} onClick={() => page(data.pagination.page - 1)}>Previous</button><span>{data.pagination.total} records · Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}</span><button className="secondary-button" disabled={data.pagination.page >= data.pagination.pages} onClick={() => page(data.pagination.page + 1)}>Next</button></div></>}
    {editing && (kind === 'plans' ? <WorkoutPlanForm record={editing.id ? editing : null} close={() => setEditing(null)} saved={() => saved('Workout plan saved.')}/> : <ExerciseForm record={editing.id ? editing : null} close={() => setEditing(null)} saved={() => saved('Exercise saved.')}/>)}
    {assigning && <AssignWorkoutForm record={assigning} close={() => setAssigning(null)} saved={() => saved('Workout assigned. View it in Assignments.')}/>}
  </div>;
}

