import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import useResource from '../hooks/useResource.js';
import MemberDialog from '../components/MemberDialog.jsx';
import { workoutApi, workoutPrescription } from '../services/workouts.js';
import { errorMessage } from '../utils/auth.js';
export default function WorkoutDetailPage() {
  const { id } = useParams(), { user } = useAuth();
  const { data, loading, error, refresh } = useResource(`/workouts/assignments/${id}`);
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [notice, setNotice] = useState(''), [confirm, setConfirm] = useState(false);
  const assignment = data?.assignment;
  async function act(index, completed) {
    if (busy) return; setBusy(true); setActionError('');
    try {
      if (index === null) await workoutApi.archive(assignment); else await workoutApi.complete(assignment, index, completed);
      setConfirm(false); setNotice(index === null ? 'Assignment archived. Its history is preserved.' : 'Completion saved.'); refresh();
    } catch (err) { setActionError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <div className="members-page workouts-page"><Link className="member-link" to={`/${user.role}/workouts`}>← Back to workouts</Link>
    {loading && <p role="status">Loading workout…</p>}{error && <div role="alert"><p>{error}</p><button onClick={refresh}>Try again</button></div>}
    {notice && <p role="status" className="member-notice">{notice}</p>}{actionError && <div role="alert"><p>{actionError}</p><button className="secondary-button" disabled={busy} onClick={() => { setActionError(''); refresh(); }}>Refresh workout</button></div>}
    {assignment && <><div className="member-page-heading"><div className="page-heading"><p className="eyebrow">YOUR WORKOUT CYCLE</p><h1 tabIndex="-1">{assignment.name}</h1><p>{assignment.memberName} · Assigned by {assignment.trainerName}</p></div><span className="member-status">{assignment.status}</span></div>
      <section className="member-panel workout-summary"><h2>{assignment.completedCount} of {assignment.itemCount} exercises complete</h2><progress value={assignment.completedCount} max={assignment.itemCount} aria-label="Workout completion"/><p className="member-text">{assignment.instructions || 'Follow the exercises below in workout-day order.'}</p><p className="member-note">One cycle · Assigned {new Date(assignment.createdAt).toLocaleDateString()} · Plan version {assignment.planVersion}. Complete all sets before marking an exercise done.</p></section>
      {[...new Set(assignment.items.map(row => row.day))].sort((a,b) => a-b).map(day => <section className="workout-day" key={day}><h2>Day {day}</h2><div className="workout-grid">{assignment.items.map((row, index) => row.day === day && <article className={`member-panel workout-card ${assignment.completed[index] ? 'workout-done' : ''}`} key={index}><h3>{row.name}</h3><p className="workout-prescription">{workoutPrescription(row)}</p>{row.exerciseInstructions && <p className="member-text">{row.exerciseInstructions}</p>}{row.instructions && <p className="member-text"><strong>Plan notes: </strong>{row.instructions}</p>}
        {user.role === 'member' && assignment.status !== 'archived' ? <label className="workout-complete"><input type="checkbox" checked={assignment.completed[index]} disabled={busy} onChange={e => act(index, e.target.checked)}/>{assignment.completed[index] ? 'Completed' : 'Mark complete'}</label> : <span className={`member-status ${assignment.completed[index] ? 'enabled' : ''}`}>{assignment.completed[index] ? 'Completed' : 'Not completed'}</span>}
      </article>)}</div></section>)}
      {user.role !== 'member' && assignment.status !== 'archived' && <section className="member-panel"><h2>Finish this assignment</h2><p>Archive to preserve this cycle and allow the same plan to be assigned again.</p><button className="secondary-button" disabled={busy} onClick={() => { setActionError(''); setConfirm(true); }}>Archive assignment</button></section>}
      {confirm && <MemberDialog title="Archive this workout?" busy={busy} close={() => setConfirm(false)}><p>The member will still see its history but can no longer change completion.</p>{actionError && <p role="alert">{actionError}</p>}<button disabled={busy} onClick={() => act(null)}>{busy ? 'Archiving…' : 'Confirm archive'}</button></MemberDialog>}
    </>}
  </div>;
}

