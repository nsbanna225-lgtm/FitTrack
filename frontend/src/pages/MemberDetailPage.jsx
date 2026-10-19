import MembershipPanel from '../components/MembershipPanel.jsx';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useResource from '../hooks/useResource.js';
import MemberAccountForm from '../components/MemberAccountForm.jsx';
import MemberProfileForm from '../components/MemberProfileForm.jsx';
import MemberDialog from '../components/MemberDialog.jsx';
import { memberApi } from '../services/members.js';
import { errorMessage } from '../utils/auth.js';
export default function MemberDetailPage() {
  const { id } = useParams();
  const { data, loading, error, refresh } = useResource(`/members/${id}`);
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  async function confirm() {
    if (busy) return;
    setBusy(true); setActionError('');
    try {
      if (action === 'Archive') await memberApi.archive(id);
      else if (action === 'Restore') await memberApi.restore(id);
      else await memberApi.update(id, { active: action === 'Activate' });
      setNotice(action === 'Restore' ? 'Member restored with an inactive account. Activate it when appropriate.' : `${action} completed.`);
      setAction(''); refresh();
    } catch (err) { setActionError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  const member = data?.member;
  return <div className="members-page"><Link className="member-link" to="/admin/members">← Back to members</Link>
    {loading && <p role="status">Loading member profile…</p>}
    {error && <div role="alert" className="member-panel"><p>{error}</p><button onClick={refresh}>Try again</button></div>}
    {notice && <p role="status" className="member-notice">{notice}</p>}
    {member && <><div className="member-page-heading"><div className="page-heading"><p className="eyebrow">MEMBER PROFILE</p><h1 tabIndex="-1">{member.name}</h1><p>{member.email}</p></div><span className={`member-status ${member.active ? 'enabled' : ''}`}>{member.archivedAt ? 'Archived' : member.active ? 'Active account' : 'Inactive account'}</span></div>
      <div className="member-detail-grid"><section className="member-panel"><h2>Account details</h2><dl className="member-details"><dt>Email</dt><dd>{member.email}</dd><dt>Phone</dt><dd>{member.phone || 'Not provided'}</dd><dt>Joined (UTC)</dt><dd>{new Date(member.createdAt).toLocaleDateString('en', { timeZone: 'UTC' })}</dd><dt>Assigned trainer</dt><dd>{data.profile.assignedTrainer?.name || 'Unassigned'}</dd></dl>
      <div className="member-actions">{!member.archivedAt && <button onClick={() => setEditing(true)}>Edit account</button>}{(member.archivedAt ? ['Restore'] : [member.active ? 'Deactivate' : 'Activate', 'Archive']).map(label => <button className="secondary-button" key={label} onClick={() => { setActionError(''); setAction(label); }}>{label}</button>)}</div><p className="member-note">Deactivation blocks sign-in. Archiving removes the member from the current directory and dashboard while preserving their profile. Existing bookings remain; cancel future sessions separately if needed.</p></section>
      <section className="member-panel">{member.archivedAt ? <><h2>Archived coaching profile</h2><p className="member-note">Restore this member to edit their profile.</p><h3>Goals</h3><p className="member-text">{data.profile.goals || 'No goals recorded.'}</p><h3>Admin notes</h3><p className="member-text">{data.profile.notes || 'No notes recorded.'}</p></> : <MemberProfileForm key={id} id={id} profile={data.profile} saved={() => { setNotice('Coaching profile saved.'); refresh(); }} />}</section></div>
      <section className="member-panel"><h2>Attendance history</h2><Link to={`/admin/attendance?memberId=${id}`}>View check-ins and attendance percentage →</Link></section><MembershipPanel key={id} memberId={id} admin/><section className="member-panel"><h2>Training sessions</h2><Link to={`/admin/sessions?memberId=${id}`}>View member schedule →</Link></section>
      <section className="member-panel"><h2>Workout history</h2><Link to={`/admin/workouts?memberId=${id}&status=all`}>View assigned workouts and completion →</Link></section><section className="member-panel"><h2>Payment history</h2><Link to={`/admin/payments?memberId=${id}`}>View demo payments for enrollments and renewals →</Link></section><section className="member-panel"><h2>Fitness progress</h2><Link to={`/admin/progress?memberId=${id}`}>View measurements, notes, and progress charts →</Link></section>
      {editing && <MemberAccountForm member={member} close={() => setEditing(false)} saved={() => { setEditing(false); setNotice('Account updated.'); refresh(); }} />}
      {action && <MemberDialog title={`${action} ${member.name}?`} busy={busy} close={() => setAction('')}><p>{action === 'Archive' ? 'This will revoke sessions and remove the member from the current directory. Their profile is retained and can be restored.' : action === 'Deactivate' ? 'This will block sign-in and revoke all existing sessions.' : action === 'Restore' ? 'This member will return to the directory with an inactive account. Their previous sessions remain invalid.' : 'This member will be able to sign in with their existing password.'}</p>{actionError && <p role="alert">{actionError}</p>}<div className="member-actions"><button onClick={confirm} disabled={busy}>{busy ? 'Updating…' : `Confirm ${action.toLowerCase()}`}</button><button className="secondary-button" disabled={busy} onClick={() => setAction('')}>Cancel</button></div></MemberDialog>}
    </>}
  </div>;
}

