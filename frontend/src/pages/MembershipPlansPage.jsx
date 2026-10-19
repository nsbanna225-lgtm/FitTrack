import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useResource from '../hooks/useResource.js';
import PlanForm from '../components/PlanForm.jsx';
import { money } from '../services/memberships.js';
export default function MembershipPlansPage() {
  const [params,setParams]=useSearchParams(),[editing,setEditing]=useState(null),[notice,setNotice]=useState('');
  const {data,loading,error,refresh}=useResource(`/memberships/plans?${params}`);
  function filter(event){event.preventDefault();setParams({...Object.fromEntries(new FormData(event.currentTarget)),page:'1'});}
  function page(value){const next=new URLSearchParams(params);next.set('page',String(value));setParams(next);}
  return <div className="members-page"><div className="member-page-heading"><div className="page-heading"><p className="eyebrow">A PLAN FOR EVERY PACE</p><h1 tabIndex="-1">Membership plans.</h1><p>Define your plans, prices, and what’s included.</p></div><button onClick={()=>setEditing({})}>Create plan</button></div>
    {notice && <p role="status" className="member-notice">{notice}</p>}
    <form className="member-filters" onSubmit={filter} key={params.toString()}><label>Search plans<input name="q" maxLength={100} defaultValue={params.get('q') || ''}/></label><label>Availability<select name="status" defaultValue={params.get('status') || 'all'}><option value="all">All plans</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><button>Apply filters</button><button type="button" className="secondary-button" onClick={()=>setParams({})}>Clear</button></form>
    {loading && <p role="status">Loading plans…</p>}{error && <div role="alert"><p>{error}</p><button onClick={refresh}>Try again</button><button className="secondary-button" onClick={()=>setParams({})}>Reset filters</button></div>}
    {data && <>{!data.plans.length && <section className="member-panel"><h2>No plans to show</h2><p>Create a plan or adjust the filters.</p></section>}<div className="plan-grid">{data.plans.map(plan=><article className="member-panel plan-card" key={plan.id}><span className={`member-status ${plan.active?'enabled':''}`}>{plan.active?'Active':'Inactive'}</span><h2>{plan.name}</h2><p className="plan-price">{money(plan.priceMinor,plan.currency)}</p><p>{plan.durationDays} days</p>{plan.features.length?<ul>{plan.features.map(feature=><li key={feature}>{feature}</li>)}</ul>:<p className="member-note">No features listed.</p>}<button className="secondary-button" onClick={()=>setEditing(plan)} aria-label={`Edit ${plan.name}`}>Edit plan</button></article>)}</div><div className="member-pagination"><button className="secondary-button" disabled={data.pagination.page<=1} onClick={()=>page(data.pagination.page-1)}>Previous</button><span>{data.pagination.total} plans · Page {data.pagination.page} of {Math.max(1,data.pagination.pages)}</span><button className="secondary-button" disabled={data.pagination.page>=data.pagination.pages} onClick={()=>page(data.pagination.page+1)}>Next</button></div></>}
    {editing && <PlanForm plan={editing.id?editing:null} close={()=>setEditing(null)} saved={()=>{setEditing(null);setNotice('Plan saved.');refresh();}}/>}
  </div>;
}

