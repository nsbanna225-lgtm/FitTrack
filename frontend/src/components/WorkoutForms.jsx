import { useState } from 'react';
import MemberDialog from './MemberDialog.jsx';
import WorkoutPicker from './WorkoutPicker.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { workoutApi, planPayload } from '../services/workouts.js';
import { errorMessage } from '../utils/auth.js';

export function ExerciseForm({ record, close, saved }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try { await workoutApi.saveExercise(record, { name: values.name, instructions: values.instructions, ...(record ? { active: values.active === 'true', expectedVersion: record.version } : {}) }); saved(); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <MemberDialog title={record ? 'Edit exercise' : 'Create exercise'} busy={busy} close={close}><form className="member-profile-form" onSubmit={submit}><fieldset disabled={busy}>
    {error && <p role="alert">{error}</p>}<label>Exercise name<input name="name" required minLength={2} maxLength={80} defaultValue={record?.name || ''}/></label>
    <label>Technique instructions<textarea name="instructions" maxLength={1000} rows={4} defaultValue={record?.instructions || ''}/></label>
    {record && <label>Availability<select name="active" defaultValue={String(record.active)}><option value="true">Active</option><option value="false">Inactive</option></select></label>}
    <p className="member-note">Library changes apply when a plan is saved. Assigned workouts keep their original instructions.</p><button>{busy ? 'Saving…' : 'Save exercise'}</button>
  </fieldset></form></MemberDialog>;
}
export function WorkoutPlanForm({ record, close, saved }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: record?.name || '', instructions: record?.instructions || '', active: record?.active ?? true });
  const [items, setItems] = useState(() => (record?.items || []).map((row, index) => ({ ...row, key: index })));
  const [selected, setSelected] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  function update(key, field, value) { setItems(rows => rows.map(row => row.key === key ? { ...row, [field]: value } : row)); }
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    if (!items.length) { setError('Add at least one exercise.'); return; }
    if (items.some(row => !row.reps && !row.durationSeconds)) { setError('Give each exercise reps or a duration.'); return; }
    setBusy(true); setError('');
    try { await workoutApi.savePlan(record, planPayload(form, items, record)); saved(); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <MemberDialog title={record ? 'Edit workout plan' : 'Create workout plan'} busy={busy} close={close}><form className="member-profile-form workout-form" onSubmit={submit}><fieldset disabled={busy}>
    {error && <p role="alert">{error}</p>}<label>Plan name<input required minLength={2} maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
    <label>Plan instructions<textarea maxLength={2000} rows={3} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })}/></label>
    <p className="member-note">Days 1–7 are ordered workout days. Each assignment is one cycle. Duration is per set; rest is between sets.</p>
    <WorkoutPicker kind="exercises" label="Find an exercise to add" selected={selected} choose={setSelected} ownerId={user.role === 'admin' ? record?.ownerId || user.id : undefined}/>
    <button type="button" className="secondary-button" disabled={!selected || items.length >= 50} onClick={() => setItems(rows => [...rows, { key: Math.max(-1, ...rows.map(r => r.key)) + 1, exerciseId: selected.id, name: selected.name, day: 1, sets: 3, reps: 10, durationSeconds: '', restSeconds: 60, instructions: '' }])}>Add selected exercise</button>
    <div className="workout-editor-items">{items.map((row, index) => <section className="workout-editor-row" key={row.key}><h3>{index + 1}. {row.name}</h3><div className="workout-fields">
      <label>Workout day<select value={row.day} onChange={e => update(row.key, 'day', e.target.value)}>{[1,2,3,4,5,6,7].map(day => <option key={day} value={day}>Day {day}</option>)}</select></label>
      {[['sets','Sets',1,50],['reps','Reps',1,1000],['durationSeconds','Duration (seconds)',1,7200],['restSeconds','Rest (seconds)',0,3600]].map(([field,label,min,max]) => <label key={field}>{label}<input type="number" min={min} max={max} step="1" required={field === 'sets' || field === 'restSeconds'} value={row[field] ?? ''} onChange={e => update(row.key, field, e.target.value)}/></label>)}
    </div><label>Instructions for this entry<textarea rows={2} maxLength={1000} value={row.instructions} onChange={e => update(row.key, 'instructions', e.target.value)}/></label><button type="button" className="secondary-button" aria-label={`Remove exercise ${index + 1}: ${row.name}`} onClick={() => setItems(rows => rows.filter(r => r.key !== row.key))}>Remove exercise</button></section>)}</div>
    {record && <label>Availability<select value={String(form.active)} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Inactive</option></select></label>}
    <p className="member-note">Saving this plan does not change workouts already assigned.</p><button>{busy ? 'Saving…' : 'Save workout plan'}</button>
  </fieldset></form></MemberDialog>;
}
export function AssignWorkoutForm({ record, close, saved }) {
  const [member, setMember] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy || !member) return;
    setBusy(true); setError('');
    try { await workoutApi.assign(record, member.id); saved(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <MemberDialog title={`Assign ${record.name}`} busy={busy} close={close}><form className="member-profile-form" onSubmit={submit}><fieldset disabled={busy}>{error && <p role="alert">{error}</p>}
    <WorkoutPicker kind="members" label="Find a member" selected={member} choose={setMember}/><p className="member-note">This creates one workout cycle with {record.items.length} exercise entries. The member can mark each entry complete. To repeat it later, archive the assignment and assign again.</p><button disabled={!member || busy}>{busy ? 'Assigning…' : 'Assign workout'}</button>
  </fieldset></form></MemberDialog>;
}
