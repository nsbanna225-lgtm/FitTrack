import { useState } from 'react';
import useResource from '../hooks/useResource.js';
import MemberDialog from './MemberDialog.jsx';
import FormMessage from './FormMessage.jsx';
import { membershipApi,money,calendarDate } from '../services/memberships.js';
import { errorMessage } from '../utils/auth.js';
function PlanPicker({selected,choose,disabled}) {
  const [q,setQ]=useState(''),[page,setPage]=useState(1);
  const {data,loading,error,refresh}=useResource(`/memberships/plans?status=active&limit=10&page=${page}&q=${encodeURIComponent(q)}`);
  return <fieldset disabled={disabled}><label className="plan-field">Find a plan<input value={q} maxLength={100} onChange={e=>{setQ(e.target.value);setPage(1);choose(null);}}/></label>
    {loading && <p role="status">Loading available plans…</p>}{error && <div role="alert"><p>{error}</p><button type="button" onClick={refresh}>Retry plans</button></div>}
    {data && <><label className="plan-field">Membership plan<select required value={selected?.id || ''} onChange={e=>choose(data.plans.find(p=>p.id===e.target.value) || null)}><option value="">Choose a plan</option>{data.plans.map(plan=><option value={plan.id} key={plan.id}>{plan.name} · {plan.durationDays} days · {money(plan.priceMinor)}</option>)}</select></label>{!data.plans.length && <p>No active plans match. Create or activate a plan first.</p>}<div className="member-pagination"><button type="button" className="secondary-button" disabled={page<=1} onClick={()=>{setPage(page-1);choose(null);}}>Previous plans</button><span>{page} / {Math.max(1,data.pagination.pages)}</span><button type="button" className="secondary-button" disabled={page>=data.pagination.pages} onClick={()=>{setPage(page+1);choose(null);}}>Next plans</button></div></>}
  </fieldset>;
}
export default function MembershipForm({memberId,membership,close,saved}) {
  const [plan,setPlan]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const today=new Date().toISOString().slice(0,10);
  const [startDate,setStartDate]=useState(today);
  const renewal=membership.version>0;
  const start=renewal?new Date(Math.max(new Date(today+'T00:00:00Z').getTime(),new Date(membership.latest.expiresAt).getTime())):new Date(startDate+'T00:00:00Z');
  const validDate=!Number.isNaN(start.getTime());
  async function submit(event){
    event.preventDefault();if(busy || !plan)return;
    setBusy(true);setError('');
    try {if(renewal)await membershipApi.renew(memberId,{planId:plan.id,expectedVersion:membership.version});else await membershipApi.enroll(memberId,{planId:plan.id,startDate});saved();}
    catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  }
  return <MemberDialog title={renewal?'Renew membership':'Enroll member'} busy={busy} close={close}><form onSubmit={submit}><FormMessage>{error}</FormMessage><PlanPicker selected={plan} choose={setPlan} disabled={busy}/><fieldset disabled={busy}>
    {!renewal && <label className="plan-field">Start date (UTC)<input type="date" required min={today} max="2099-12-31" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>}
    {plan && validDate && <div className="membership-preview"><strong>{plan.name} · {money(plan.priceMinor)}</strong><p>{calendarDate(start)} through {calendarDate(new Date(start.getTime()+(plan.durationDays-1)*86400000))}, inclusive (UTC).</p><p>{plan.durationDays} days of coverage.</p><ul>{plan.features.map(feature=><li key={feature}>{feature}</li>)}</ul></div>}
    <p className="member-note">{renewal?'Renewal starts after the latest coverage ends, or today if expired. ':''}This records membership coverage only. It does not collect or confirm a payment. Saved coverage cannot be edited in this phase.</p>
    <button className="primary-button" disabled={busy || !plan}>{busy?'Saving…':renewal?'Confirm renewal':'Confirm enrollment'}</button>
  </fieldset></form></MemberDialog>;
}
