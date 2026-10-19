import { Link } from 'react-router-dom';
import { useState } from 'react';
import useResource from '../hooks/useResource.js';
import MembershipForm from './MembershipForm.jsx';
import { calendarDate,money } from '../services/memberships.js';
export default function MembershipPanel({memberId,admin=false}) {
  const {data,loading,error,refresh}=useResource(admin?`/memberships/members/${memberId}`:'/memberships/me');
  const [editing,setEditing]=useState(false),[notice,setNotice]=useState(''),[page,setPage]=useState(1);
  const membership=data?.membership;
  const current=membership?.current || membership?.next || membership?.latest;
  return <section className="member-panel membership-panel" aria-busy={loading}><div className="member-list-title"><h2>Membership coverage</h2><button className="secondary-button" onClick={refresh} disabled={loading}>Refresh membership</button></div>
    {notice && <p className="member-notice" role="status">{notice}</p>}{loading && <p role="status">Loading membership…</p>}{error && <div role="alert"><p>{error}</p><button onClick={refresh}>Try again</button></div>}
    {membership && <><span className={`member-status ${membership.status==='active'?'enabled':''}`}>{membership.status==='none'?'Not enrolled':membership.status}</span>
      {current?<><h3>{current.planName}</h3><p>{calendarDate(current.startAt)} – {calendarDate(new Date(new Date(current.expiresAt).getTime()-86400000))}, inclusive (UTC)</p><p>Recorded plan price: {money(current.priceMinor,current.currency)} · {current.durationDays} days</p>{current.features.length>0 && <ul>{current.features.map(feature=><li key={feature}>{feature}</li>)}</ul>}{membership.next && membership.current && <p className="member-notice">Next: {membership.next.planName} starts {calendarDate(membership.next.startAt)}.</p>}<p className="member-note">Coverage ends at {calendarDate(membership.latest.expiresAt)}, 00:00 UTC. Account access and payment status are separate.</p></>:<p>No membership has been recorded yet.</p>}
      {admin && <div className="member-actions"><button disabled={!data.member.active || !!data.member.archivedAt} onClick={()=>setEditing(true)}>{membership.version?'Renew membership':'Enroll member'}</button>{(!data.member.active || data.member.archivedAt) && <p className="member-note">Restore and activate the account before adding coverage.</p>}</div>}
      {membership.history.length>0 && <><p><Link to={admin ? `/admin/payments?memberId=${memberId}` : '/member/payments'}>View enrollment & renewal demo payments →</Link></p><h3>Enrollment & renewal history</h3><div className="member-table-scroll" role="region" aria-label="Membership history" tabIndex="0"><table className="member-table"><caption>Saved plan details at enrollment; prices do not indicate payment.</caption><thead><tr><th scope="col">Plan</th><th scope="col">Start (UTC)</th><th scope="col">Last covered day (UTC)</th><th scope="col">Price</th><th scope="col">Status</th></tr></thead><tbody>{membership.history.slice((page-1)*10,page*10).map(period=><tr key={period.id}><td><strong>{period.planName}</strong><span>{period.durationDays} days</span></td><td>{calendarDate(period.startAt)}</td><td>{calendarDate(new Date(new Date(period.expiresAt).getTime()-86400000))}</td><td>{money(period.priceMinor,period.currency)}</td><td>{period.status}</td></tr>)}</tbody></table></div>{membership.history.length>10 && <div className="member-pagination"><button className="secondary-button" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous history</button><span>Page {page} of {Math.ceil(membership.history.length/10)}</span><button className="secondary-button" disabled={page*10>=membership.history.length} onClick={()=>setPage(page+1)}>Next history</button></div>}</>}
    </>}
    {editing && membership && <MembershipForm memberId={memberId} membership={membership} close={()=>setEditing(false)} saved={()=>{setEditing(false);setNotice('Membership saved.');setPage(1);refresh();}}/>}
  </section>;
}

