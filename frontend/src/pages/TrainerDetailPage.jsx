import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useResource from '../hooks/useResource.js';
import MemberAccountForm from '../components/MemberAccountForm.jsx';
import MemberDialog from '../components/MemberDialog.jsx';
import TrainerProfileForm, { weekdays } from '../components/TrainerProfileForm.jsx';
import { trainerApi } from '../services/trainers.js';
import { errorMessage } from '../utils/auth.js';
function AssignedMembers({ id }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useResource(`/trainers/${id}/members?limit=10&page=${page}&sort=name`);
  return <section className="member-panel"><h2>Assigned members</h2><p className="member-note">Current assignments, excluding archived members. Manage assignments from each member’s profile.</p>
    {loading && <p role="status">Loading assigned members…</p>}{error && <div role="alert"><p>{error}</p><button onClick={refresh}>Try again</button></div>}
    {data && <>{data.members.length ? <ul className="trainer-assignees">{data.members.map(member => <li key={member.id}><Link to={`/admin/members/${member.id}`}>{member.name}</Link><span>{member.active ? 'Active account' : 'Inactive account'}</span></li>)}</ul> : <p>No members on this page.</p>}<div className="member-pagination"><button className="secondary-button" disabled={page <= 1} onClick={() => setPage(page-1)}>Previous</button><span>{data.pagination.total} assigned · Page {page} of {Math.max(1,data.pagination.pages)}</span><button className="secondary-button" disabled={page >= data.pagination.pages} onClick={() => setPage(page+1)}>Next</button></div></>}
  </section>;
}
export default function TrainerDetailPage() {
  const { id } = useParams();
  const { data, loading, error, refresh } = useResource(`/trainers/${id}`);
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  async function confirm() {
    if (busy) return;
    setBusy(true); setActionError('');
    try {
      if (action === 'Archive') await trainerApi.archive(id);
      else if (action === 'Restore') await trainerApi.restore(id);
      else await trainerApi.update(id, { active: action === 'Activate' });
      setNotice(action === 'Restore' ? 'Trainer restored with an inactive account.' : `${action} completed.`);
      setAction(''); refresh();
    } catch (err) { setActionError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  const trainer = data?.trainer;
  return <div className="members-page"><Link className="member-link" to="/admin/trainers">← Back to trainers</Link>
    {loading && <p role="status">Loading trainer profile…</p>}{error && <div className="member-panel" role="alert"><p>{error}</p><button onClick={refresh}>Try again</button></div>}{notice && <p role="status" className="member-notice">{notice}</p>}
    {trainer && <><div className="member-page-heading"><div className="page-heading"><p className="eyebrow">TRAINER PROFILE</p><h1 tabIndex="-1">{trainer.name}</h1><p>{trainer.email}</p></div><span className={`member-status ${trainer.active ? 'enabled' : ''}`}>{trainer.archivedAt ? 'Archived' : trainer.active ? 'Active account' : 'Inactive account'}</span></div>
      <div className="member-detail-grid"><div className="trainer-summary"><section className="member-panel"><h2>Account & workload</h2><dl className="member-details"><dt>Phone</dt><dd>{trainer.phone || 'Not provided'}</dd><dt>Assigned members</dt><dd>{data.workload.assignedMembers}</dd><dt>Active assigned accounts</dt><dd>{data.workload.activeMemberAccounts}</dd><dt>Experience</dt><dd>{data.profile.experienceYears} years</dd><dt>Specializations</dt><dd>{data.profile.specializations.join(', ') || 'Not provided'}</dd></dl><div className="member-actions">{!trainer.archivedAt && <button onClick={() => setEditing(true)}>Edit account</button>}{(trainer.archivedAt ? ['Restore'] : [trainer.active ? 'Deactivate' : 'Activate','Archive']).map(label => <button className="secondary-button" key={label} onClick={() => {setActionError('');setAction(label);}}>{label}</button>)}</div><p className="member-note">Inactive or archived trainers cannot sign in or receive new member assignments. Existing assignments and bookings are retained. Review the session schedule to cancel future bookings when needed.</p></section><AssignedMembers key={id} id={id} /></div>
      <section className="member-panel">{trainer.archivedAt ? <><h2>Archived professional profile</h2><p className="member-text">{data.profile.bio || 'No biography recorded.'}</p><h3>Weekly hours · {data.profile.timezone}</h3>{data.profile.availability.length ? <ul>{data.profile.availability.map((s,i) => <li key={i}>{weekdays[s.day]} {s.start}–{s.end}</li>)}</ul> : <p>No published hours.</p>}<p className="member-note">Restore the trainer to edit this profile.</p></> : <TrainerProfileForm key={id} id={id} profile={data.profile} saved={() => {setNotice('Trainer profile saved.');refresh();}} />}</section></div>
      <div className="member-history-grid"><section className="member-panel"><h2>Session schedule</h2><p>Review upcoming, completed, and cancelled sessions for this trainer.</p><Link to={`/admin/sessions?trainerId=${id}`}>View trainer schedule →</Link></section><section className="member-panel"><h2>Session performance</h2><span className="member-status">Coming soon</span><p className="member-note">Completion and cancellation metrics need session records. Workload above counts current assignments only.</p></section></div>
      {editing && <MemberAccountForm kind="trainer" member={trainer} close={() => setEditing(false)} saved={() => {setEditing(false);setNotice('Account updated.');refresh();}} />}
      {action && <MemberDialog title={`${action} ${trainer.name}?`} close={() => setAction('')} busy={busy}><p>{action === 'Archive' ? 'Revoke sessions and remove this trainer from the current directory. Keep the profile and existing member assignments.' : action === 'Deactivate' ? 'Block sign-in, revoke sessions, and prevent new assignments. Existing member assignments remain.' : action === 'Restore' ? 'Restore this trainer as inactive. Activate separately to allow sign-in and new assignments.' : 'Allow this trainer to sign in and receive new member assignments.'}</p>{actionError && <p role="alert">{actionError}</p>}<div className="member-actions"><button disabled={busy} onClick={confirm}>{busy ? 'Updating…' : `Confirm ${action.toLowerCase()}`}</button><button className="secondary-button" disabled={busy} onClick={() => setAction('')}>Cancel</button></div></MemberDialog>}
    </>}
  </div>;
}

