import { useState } from 'react';
import MemberDialog from './MemberDialog.jsx';
import FormField from './FormField.jsx';
import FormMessage from './FormMessage.jsx';
import { membershipApi,parsePrice } from '../services/memberships.js';
import { errorMessage } from '../utils/auth.js';
export default function PlanForm({plan,close,saved}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event) {
    event.preventDefault();if(busy)return;
    const values=Object.fromEntries(new FormData(event.currentTarget));
    let priceMinor;
    try {priceMinor=parsePrice(values.price);} catch(err){setError(err.message);return;}
    const body={name:values.name,durationDays:Number(values.durationDays),priceMinor,features:values.features.split('\n').map(f=>f.trim()).filter(Boolean),active:values.active==='true'};
    setBusy(true);setError('');
    try {if(plan)await membershipApi.updatePlan(plan.id,body);else await membershipApi.createPlan(body);saved();}
    catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  }
  return <MemberDialog title={plan?'Edit membership plan':'Create membership plan'} close={close} busy={busy}><form onSubmit={submit}><FormMessage>{error}</FormMessage><fieldset disabled={busy}>
    <FormField label="Plan name" name="name" required minLength={2} maxLength={80} defaultValue={plan?.name || ''}/>
    <FormField label="Duration in days" name="durationDays" type="number" required min="1" max="3660" step="1" defaultValue={plan?.durationDays || 30}/>
    <FormField label="Price (INR)" name="price" inputMode="decimal" required defaultValue={plan?(plan.priceMinor/100).toFixed(2):'0.00'} hint="Up to two decimal places. This is the plan price; no payment is collected here."/>
    <label className="plan-field">Features, one per line<textarea name="features" rows={5} maxLength={3220} defaultValue={plan?.features.join('\n') || ''}/></label>
    <label className="plan-field">Availability<select name="active" defaultValue={String(plan?.active ?? true)}><option value="true">Active — available for enrollment</option><option value="false">Inactive — unavailable for new coverage</option></select></label>
    <p className="member-note">Changes apply to future enrollments and renewals. Existing coverage keeps its original price, duration, and features.</p>
    <button className="primary-button" disabled={busy}>{busy?'Saving…':plan?'Save plan':'Create plan'}</button>
  </fieldset></form></MemberDialog>;
}
