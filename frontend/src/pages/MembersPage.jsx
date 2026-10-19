import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useResource from '../hooks/useResource.js';
import MemberAccountForm from '../components/MemberAccountForm.jsx';
export default function MembersPage({ kind = 'member' }) {
  const plural = `${kind}s`;
  const title = kind === 'trainer' ? 'Trainer' : 'Member';
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const resource = useResource(`/${plural}?${params.toString()}`);
  const { data, loading, error, refresh } = resource;
  function filter(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setParams({ ...fields, page: '1' });
  }
  function page(value) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next); }
  return <div className="members-page"><div className="member-page-heading"><div className="page-heading"><p className="eyebrow">PEOPLE FIRST</p><h1 tabIndex="-1">Your {plural}.</h1><p>Manage the people at the heart of your community.</p></div><button onClick={() => setAdding(true)}>Add {kind}</button></div>
    {notice && <p role="status" className="member-notice">{notice}</p>}
    <form className="member-filters" onSubmit={filter} key={params.toString()}><label>Search {plural}<input name="q" defaultValue={params.get('q') || ''} maxLength={100} placeholder="Name, email, or phone" /></label><label>Account status<select name="status" defaultValue={params.get('status') || 'all'}><option value="all">All current {plural}</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></label><label>Sort by<select name="sort" defaultValue={params.get('sort') || 'newest'}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></label><label>Per page<select name="limit" defaultValue={params.get('limit') || '10'}><option>10</option><option>25</option><option>50</option></select></label><button type="submit">Apply filters</button><button className="secondary-button" type="button" onClick={() => setParams({})}>Clear</button></form>
    <section className="member-panel" aria-busy={loading}>
      {loading && <p role="status">Loading members…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={refresh}>Try again</button><button className="secondary-button" onClick={() => setParams({})}>Reset filters</button></div>}
      {data && <><div className="member-list-title"><h2>{title} directory</h2><span>{data.pagination.total} matching {plural}</span></div>
        {data[plural].length ? <div className="member-table-scroll" role="region" aria-label={`${title} directory table`} tabIndex="0"><table className="member-table"><caption>Account access status; archived accounts are retained separately.</caption><thead><tr><th scope="col">{title}</th><th scope="col">Phone</th><th scope="col">Account</th><th scope="col">Joined</th><th scope="col">Profile</th></tr></thead><tbody>{data[plural].map(member => <tr key={member.id}><td><strong>{member.name}</strong><span>{member.email}</span></td><td>{member.phone || '—'}</td><td><span className={`member-status ${member.active ? 'enabled' : ''}`}>{member.archivedAt ? 'Archived' : member.active ? 'Active' : 'Inactive'}</span></td><td>{new Date(member.createdAt).toLocaleDateString('en', { timeZone: 'UTC' })}</td><td><Link className="member-link" to={`/admin/${plural}/${member.id}`} aria-label={`View ${member.name}`}>View profile →</Link></td></tr>)}</tbody></table></div> : <div className="member-empty"><h3>No {plural} to show</h3><p>Add a {kind} or adjust the filters to find an existing account.</p></div>}
        <div className="member-pagination"><button className="secondary-button" disabled={data.pagination.page <= 1} onClick={() => page(data.pagination.page - 1)}>Previous</button><span>Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}</span><button className="secondary-button" disabled={data.pagination.page >= data.pagination.pages} onClick={() => page(data.pagination.page + 1)}>Next</button></div></>}
    </section>
    {adding && <MemberAccountForm kind={kind} close={() => setAdding(false)} saved={() => { setAdding(false); setNotice(`${title} created.`); refresh(); }} />}
  </div>;
}

