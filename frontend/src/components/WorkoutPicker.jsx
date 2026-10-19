import { useId, useState } from 'react';
import useResource from '../hooks/useResource.js';
export default function WorkoutPicker({ kind, label, selected, choose, ownerId }) {
  const [search, setSearch] = useState(''), [q, setQ] = useState(''), [page, setPage] = useState(1);
  const id = useId();
  const { data, loading, error, refresh } = useResource(`/workouts/${kind}?q=${encodeURIComponent(q)}&page=${page}${ownerId ? `&ownerId=${ownerId}` : ''}`);
  return <div className="workout-picker">
    <label htmlFor={id}>{label}</label><div className="workout-search"><input id={id} value={search} maxLength={100} onChange={e => setSearch(e.target.value)} placeholder="Search by name" /><button type="button" className="secondary-button" onClick={() => { setQ(search); setPage(1); }}>Search</button></div>
    {selected && <p className="member-note">Selected: <strong>{selected.name}</strong></p>}
    {loading && <p role="status">Loading options…</p>}{error && <div role="alert">{error} <button type="button" onClick={refresh}>Retry</button></div>}
    {data && <><div className="workout-options">{data.records.map(row => <button type="button" className="secondary-button" key={row.id} aria-pressed={selected?.id === row.id} onClick={() => choose(row)}>{row.name}</button>)}</div>{!data.records.length && <p>No matches. {kind === 'exercises' ? 'Create an exercise in the library first.' : 'An admin can assign members to trainers from member profiles.'}</p>}
      <div className="member-pagination"><button type="button" className="secondary-button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous options</button><span>Page {page} of {Math.max(1, data.pagination.pages)}</span><button type="button" className="secondary-button" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next options</button></div></>}
  </div>;
}
