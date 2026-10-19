import { useState } from 'react';
import useResource from '../hooks/useResource.js';
import { useAuth } from '../hooks/useAuth.js';
import MemberDialog from './MemberDialog.jsx';
import api from '../services/api.js';
import { errorMessage } from '../utils/auth.js';

function ParticipantPicker({ kind, choose, selected }) {
  const [q, setQ] = useState(''), [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useResource(kind === 'trainer' ? `/sessions/trainers?q=${encodeURIComponent(q)}&page=${page}` : `/members?status=active&sort=name&limit=10&q=${encodeURIComponent(q)}&page=${page}`);
  const items = data?.[kind === 'trainer' ? 'trainers' : 'members'] || [];
  return <fieldset className="session-picker"><label className="plan-field">Find a {kind}<input value={q} maxLength={100} onChange={e => { setQ(e.target.value); setPage(1); choose(null); }} /></label>
    {loading && <p role="status">Loading {kind}s…</p>}{error && <p role="alert">{error} <button type="button" onClick={refresh}>Retry</button></p>}
    {data && <><label className="plan-field">{kind === 'trainer' ? 'Trainer' : 'Member'}<select required value={selected?.id || ''} onChange={e => choose(items.find(item => item.id === e.target.value) || null)}><option value="">Choose a {kind}</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}{kind === 'member' ? ` · ${item.email}` : ` · ${item.timezone}`}</option>)}</select></label>
      {!items.length && <p>{kind === 'trainer' ? 'No active trainers with published hours match.' : 'No active members match.'}</p>}
      <div className="member-pagination"><button type="button" className="secondary-button" disabled={page <= 1} onClick={() => { setPage(page - 1); choose(null); }}>Previous {kind}s</button><span>{page} / {Math.max(1, data.pagination.pages)}</span><button type="button" className="secondary-button" disabled={page >= data.pagination.pages} onClick={() => { setPage(page + 1); choose(null); }}>Next {kind}s</button></div></>}
  </fieldset>;
}
function TimePicker({ path, selected, choose }) {
  const { data, loading, error, refresh } = useResource(path);
  return <div className="session-times"><div className="member-list-title"><h3>Available times</h3><button type="button" className="secondary-button" disabled={loading} onClick={() => { choose(''); refresh(); }}>Refresh times</button></div>
    {loading && <p role="status">Checking availability and membership coverage…</p>}{error && <p role="alert">{error}</p>}
    {data && <><p>Times in {data.timezone}. Offsets distinguish repeated daylight-saving times.</p>{data.slots.length ? <label className="plan-field">Session time<select required value={selected} onChange={e => choose(e.target.value)}><option value="">Choose an available time</option>{data.slots.map(slot => <option key={slot.startAt} value={slot.startAt}>{new Date(slot.startAt).toLocaleTimeString('en-GB', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' })}</option>)}</select></label> : <p>No available times. Try another date or duration, or ask an administrator to check membership coverage and trainer hours.</p>}</>}
  </div>;
}
export default function SessionForm({ session, close, saved }) {
  const { user } = useAuth();
  const [trainer, setTrainer] = useState(session ? { id: session.trainerId, name: session.trainerName, timezone: session.timezone } : null);
  const [member, setMember] = useState(session ? { id: session.memberId, name: session.memberName } : null);
  const [date, setDate] = useState(''), [duration, setDuration] = useState(session ? (+new Date(session.endAt) - +new Date(session.startAt)) / 60000 : 60);
  const [selected, setSelected] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const memberId = user.role === 'admin' ? member?.id : user.id;
  const params = new URLSearchParams({ trainerId: trainer?.id || '', date, durationMinutes: String(duration), ...(user.role === 'admin' ? { memberId: memberId || '' } : {}), ...(session ? { excludeId: session.id } : {}) });
  const path = `/sessions/slots?${params}`;
  async function submit(event) {
    event.preventDefault(); if (busy || !selected) return;
    setBusy(true); setError('');
    try {
      const body = { startAt: selected, durationMinutes: Number(duration) };
      if (session) await api.patch(`/sessions/${session.id}`, { ...body, expectedVersion: session.version });
      else await api.post('/sessions', { ...body, trainerId: trainer.id, ...(user.role === 'admin' ? { memberId } : {}) });
      saved();
    } catch (err) { setError(errorMessage(err)); setSelected(''); }
    finally { setBusy(false); }
  }
  return <MemberDialog title={session ? 'Reschedule session' : 'Book a session'} busy={busy} close={close}><form onSubmit={submit}>{error && <p role="alert">{error}</p>}<fieldset disabled={busy}>
    {session ? <p>{session.memberName} with {session.trainerName}. Participants stay the same.</p> : <>{user.role === 'admin' && <ParticipantPicker kind="member" selected={member} choose={value => { setMember(value); setSelected(''); }} />}<ParticipantPicker kind="trainer" selected={trainer} choose={value => { setTrainer(value); setSelected(''); }} /></>}
    {trainer && <><p className="member-note">Trainer’s time zone: <strong>{trainer.timezone}</strong></p>{trainer.availability && <details><summary>Published weekly hours</summary><ul>{trainer.availability.map((s,i) => <li key={i}>{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][s.day]} {s.start}–{s.end}</li>)}</ul></details>}</>}
    <label className="plan-field">Date in trainer’s time zone<input required type="date" value={date} onChange={e => { setDate(e.target.value); setSelected(''); }} /></label>
    <label className="plan-field">Duration<select value={duration} onChange={e => { setDuration(Number(e.target.value)); setSelected(''); }}>{Array.from({ length: 12 }, (_, i) => (i + 1) * 15).map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
    {trainer && memberId && date && <TimePicker key={path} path={path} selected={selected} choose={setSelected} />}
    <p className="member-note">Membership must cover the full session. Times are reserved when you confirm; someone else may book a displayed time first. No payment is collected here.</p>
    <button className="primary-button" disabled={busy || !selected}>{busy ? 'Saving…' : session ? 'Confirm reschedule' : 'Confirm booking'}</button>
  </fieldset></form></MemberDialog>;
}
