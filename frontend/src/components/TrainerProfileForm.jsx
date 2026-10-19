import { useState } from 'react';
import { trainerApi } from '../services/trainers.js';
import { errorMessage } from '../utils/auth.js';
import FormMessage from './FormMessage.jsx';
export const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export default function TrainerProfileForm({ id, profile, saved }) {
  const [slots, setSlots] = useState(profile.availability);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function change(index, key, value) { setSlots(slots.map((slot,i) => i === index ? { ...slot, [key]: value } : slot)); }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const body = { bio: fields.bio, timezone: fields.timezone.trim(), experienceYears: Number(fields.experienceYears), specializations: fields.specializations.split(',').map(s => s.trim()).filter(Boolean), availability: slots };
    setBusy(true); setError('');
    try { await trainerApi.profile(id, body); saved(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="member-profile-form" aria-busy={busy}><h2>Professional profile</h2><FormMessage>{error}</FormMessage><fieldset disabled={busy}>
    <label>Specializations<input name="specializations" defaultValue={profile.specializations.join(', ')} maxLength={620} placeholder="Strength training, Mobility" /></label><p className="member-note">Separate up to 10 specializations with commas.</p>
    <label>Years of experience<input name="experienceYears" type="number" min="0" max="80" step="1" required defaultValue={profile.experienceYears} /></label>
    <label>Biography<textarea name="bio" maxLength={2000} rows={4} defaultValue={profile.bio} /></label>
    <h3>Weekly working hours</h3><p className="member-note">Times use the time zone below. Leave the list empty for no published hours. Use separate, non-overlapping intervals on the same day. Booking and date-specific schedules arrive in Phase 9.</p>
    <label>Time zone<input name="timezone" required maxLength={100} defaultValue={profile.timezone} placeholder="Asia/Kolkata" /></label>
    {slots.map((slot,i) => <div className="trainer-slot" key={i}><label>Day<select aria-label={`Day for interval ${i+1}`} value={slot.day} onChange={e => change(i,'day',Number(e.target.value))}>{weekdays.map((day,d) => <option value={d} key={day}>{day}</option>)}</select></label><label>Start<input aria-label={`Start for interval ${i+1}`} type="time" required value={slot.start} onChange={e => change(i,'start',e.target.value)} /></label><label>End<input aria-label={`End for interval ${i+1}`} type="time" required value={slot.end} onChange={e => change(i,'end',e.target.value)} /></label><button type="button" className="secondary-button" aria-label={`Remove interval ${i+1}`} onClick={() => setSlots(slots.filter((_,j) => j !== i))}>Remove</button></div>)}
    <div className="member-actions"><button type="button" className="secondary-button" disabled={slots.length >= 28} onClick={() => setSlots([...slots,{day:1,start:'09:00',end:'17:00'}])}>Add interval</button><button disabled={busy}>{busy ? 'Saving…' : 'Save trainer profile'}</button></div>
  </fieldset></form>;
}
