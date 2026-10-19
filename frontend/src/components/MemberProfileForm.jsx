import { useState } from 'react';
import useResource from '../hooks/useResource.js';
import { memberApi } from '../services/members.js';
import { errorMessage } from '../utils/auth.js';
import FormMessage from './FormMessage.jsx';
export default function MemberProfileForm({ id, profile, saved }) {
  const trainers = useResource('/members/trainers');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const assigned = profile.assignedTrainer;
  const [trainerId, setTrainerId] = useState(assigned?.id || '');
  const missingOption = assigned && !trainers.data?.trainers.some(trainer => trainer.id === assigned.id);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    values.assignedTrainer = values.assignedTrainer || null;
    // Preserve a previous assignment when it is not currently selectable.
    if (missingOption && values.assignedTrainer === assigned.id) delete values.assignedTrainer;
    setBusy(true); setError(''); setNotice('');
    try { await memberApi.profile(id, values); setNotice('Member profile saved.'); saved(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="member-profile-form" aria-busy={busy}><h2>Coaching profile</h2><FormMessage>{error}</FormMessage><FormMessage success>{notice}</FormMessage>
    {trainers.error && <div role="alert"><p>Trainer options could not load.</p><button type="button" onClick={trainers.refresh}>Retry trainers</button></div>}
    <fieldset disabled={busy || trainers.loading || !!trainers.error}><label>Assigned trainer<select name="assignedTrainer" value={trainerId} onChange={event => setTrainerId(event.target.value)}><option value="">Unassigned</option>{missingOption && <option value={assigned.id}>{assigned.name} (unavailable)</option>}{trainers.data?.trainers.map(trainer => <option key={trainer.id} value={trainer.id}>{trainer.name} · {trainer.email}</option>)}</select></label>
    {!trainers.loading && !trainers.error && !trainers.data?.trainers.length && <p className="member-note">No active trainers available. You can save an unassigned profile.</p>}
    <label>Fitness goals<textarea name="goals" defaultValue={profile.goals} maxLength={1000} rows={3} /></label><label>Admin notes<textarea name="notes" defaultValue={profile.notes} maxLength={2000} rows={4} /></label><p className="member-note">Goals and notes are visible only to administrators in this phase.</p><button disabled={busy || trainers.loading || !!trainers.error}>{busy ? 'Saving…' : 'Save coaching profile'}</button></fieldset>
  </form>;
}
