import { useState } from 'react';
import MemberDialog from './MemberDialog.jsx';
import api from '../services/api.js';
import { errorMessage } from '../utils/auth.js';
import { measurements, progressPayload } from '../utils/progress.js';
export default function ProgressForm({ memberId, record, close, saved }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const payload = progressPayload(Object.fromEntries(new FormData(event.currentTarget)), record?.version);
    setBusy(true); setError('');
    try {
      const path = `/progress/members/${memberId}`;
      if (record) await api.put(`${path}/${record.id}`, payload); else await api.post(path, payload);
      saved(payload.day);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <MemberDialog title={record ? 'Edit progress entry' : 'Record your progress'} busy={busy} close={close}>
    <form className="member-profile-form" onSubmit={submit}><fieldset disabled={busy}>
      {error && <p role="alert">{error}</p>}
      <label>Measurement date (UTC)<input type="date" name="day" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} defaultValue={record?.day || new Date().toISOString().slice(0, 10)}/></label>
      <div className="progress-fields">{measurements.map(([key, label, min, max]) => <label key={key}>{label}{key !== 'weightKg' && ' (optional)'}<input type="number" name={key} min={min} max={max} step="0.1" required={key === 'weightKg'} defaultValue={record?.[key] ?? ''}/></label>)}</div>
      <label>Progress notes (optional)<textarea name="notes" maxLength={2000} rows={4} defaultValue={record?.notes || ''}/></label>
      <p className="member-note">One entry per date. Height is saved with this entry to calculate BMI; blank height leaves BMI unavailable. Measurements and notes are visible to admins and your assigned trainer.</p>
      <button>{busy ? 'Saving…' : 'Save progress'}</button>
    </fieldset></form>
  </MemberDialog>;
}
