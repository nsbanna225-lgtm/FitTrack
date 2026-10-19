import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import Membership from '../src/models/Membership.js';
import { issueToken } from '../src/services/tokenService.js';
import { enroll,renew,memberMembership,membershipStats,listMemberships } from '../src/services/membershipService.js';
import { day } from '../src/validators/membershipValidators.js';
process.env.JWT_SECRET=randomBytes(48).toString('hex');
const database=`fittrack_test_memberships_${randomUUID().replaceAll('-','')}`;
test('membership plans and coverage with isolated MongoDB',{timeout:60000},async t=>{
 let server;
 try{
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`,{serverSelectionTimeoutMS:5000});
  await MembershipPlan.createIndexes();
  const make=role=>User.create({name:`Test ${role}`,email:`${randomUUID()}@example.test`,role,passwordHash:'test-only'});
  const admin=await make('admin'),member=await make('member'),other=await make('member'),trainer=await make('trainer');
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base=`http://127.0.0.1:${server.address().port}/api/memberships`;
  const token=issueToken(admin);
  async function request(path='',{method='GET',body,auth=token}={}){
   const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
   return {status:res.status,data:await res.json(),headers:res.headers};
  }
  let planId;
  const fields={name:'Foundation (30)',durationDays:30,priceMinor:199999,features:['Gym access','Group classes']};
  await t.test('admin endpoints reject guests, members and trainers; self-service is member-only',async()=>{
   for(const [auth,status] of [[null,401],[issueToken(member),403],[issueToken(trainer),403]])
    for(const [path,method] of [['','GET'],['/plans','GET'],['/plans','POST'],[`/plans/${member.id}`,'PATCH'],[`/members/${member.id}`,'GET'],[`/members/${member.id}`,'POST'],[`/members/${member.id}/renew`,'POST']])assert.equal((await request(path,{method,auth,body:['POST','PATCH'].includes(method)?fields:undefined})).status,status);
   assert.equal((await request('/me')).status,403);assert.equal((await request('/me',{auth:issueToken(trainer)})).status,403);
   assert.equal((await request('/me',{auth:issueToken(member)})).data.membership.status,'none');
  });
  await t.test('plans validate amounts, duration, features, unique names and search',async()=>{
   const created=await request('/plans',{method:'POST',body:fields});assert.equal(created.status,201);planId=created.data.plan.id;assert.equal(created.headers.get('cache-control'),'no-store');
   assert.equal((await request('/plans',{method:'POST',body:{...fields,name:' FOUNDATION (30) '}})).status,409);
   for(const changes of [{priceMinor:1.5},{priceMinor:-1},{priceMinor:'100'},{durationDays:0},{durationDays:3661},{features:['']},{currency:'USD'},{active:'true'}])assert.equal((await request('/plans',{method:'POST',body:{...fields,name:randomUUID(),...changes}})).status,400);
   assert.equal((await request('/plans?q=%2830%29')).data.pagination.total,1);assert.equal((await request('/plans?q=.*')).data.pagination.total,0);
   assert.equal((await request('/plans?limit=0')).status,400);assert.equal((await request('/plans?status=expired')).status,400);
  });
  await t.test('calendar validation rejects impossible dates and backdating',async()=>{
   for(const value of ['2026-02-29','2026-02-30','2026-13-01','2026-1-01','2026-01-01T12:00:00Z'])assert.throws(()=>day(value));
   assert.equal(day('2028-02-29').toISOString(),'2028-02-29T00:00:00.000Z');
   assert.equal((await request(`/members/${member.id}`,{method:'POST',body:{planId,startDate:'2000-01-01'}})).status,400);
   assert.equal((await request(`/members/${trainer.id}`,{method:'POST',body:{planId,startDate:'2090-01-01'}})).status,404);
  });
  const now=new Date('2028-02-28T12:00:00Z');
  await t.test('concurrent enrollment creates exactly one membership and one saved period',async()=>{
   const responses=await Promise.allSettled([enroll(member.id,{planId,startAt:day('2028-02-28')},admin._id,now),enroll(member.id,{planId,startAt:day('2028-02-28')},admin._id,now)]);
   assert.equal(responses.filter(r=>r.status==='fulfilled').length,1);assert.equal(responses.find(r=>r.status==='rejected').reason.status,409);
   const saved=(await memberMembership(member.id,now)).membership;assert.equal(saved.version,1);assert.equal(saved.status,'active');assert.equal(saved.history.length,1);
   assert.equal(saved.current.expiresAt.toISOString(),'2028-03-29T00:00:00.000Z');assert.equal(saved.current.priceMinor,199999);
  });
  await t.test('editing a plan preserves old snapshots; concurrent renewals extend only once',async()=>{
   assert.equal((await request(`/plans/${planId}`,{method:'PATCH',body:{name:'Updated plan',durationDays:10,priceMinor:99900,features:['Updated feature']}})).status,200);
   const results=await Promise.allSettled([renew(member.id,{planId,expectedVersion:1},admin._id,now),renew(member.id,{planId,expectedVersion:1},admin._id,now)]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
   const view=(await memberMembership(member.id,now)).membership;
   assert.equal(view.version,2);assert.equal(view.current.planName,fields.name);assert.equal(view.current.priceMinor,199999);assert.deepEqual(view.current.features,fields.features);
   assert.equal(view.next.planName,'Updated plan');assert.equal(view.next.priceMinor,99900);assert.equal(view.next.startAt.toISOString(),'2028-03-29T00:00:00.000Z');assert.equal(view.next.expiresAt.toISOString(),'2028-04-08T00:00:00.000Z');
   assert.equal((await request(`/members/${member.id}/renew`,{method:'POST',body:{planId,expectedVersion:1}})).status,409);
  });
  await t.test('UTC expiry is exclusive and renewal changes current plan at the exact boundary',async()=>{
   assert.equal((await memberMembership(member.id,new Date('2028-02-27T23:59:59Z'))).membership.status,'scheduled');
   assert.equal((await memberMembership(member.id,new Date('2028-03-28T23:59:59.999Z'))).membership.current.planName,fields.name);
   assert.equal((await memberMembership(member.id,new Date('2028-03-29T00:00:00Z'))).membership.current.planName,'Updated plan');
   assert.equal((await memberMembership(member.id,new Date('2028-04-08T00:00:00Z'))).membership.status,'expired');
   const expiredNow=new Date('2028-05-01T19:30:00Z');
   const result=await renew(member.id,{planId,expectedVersion:2},admin._id,expiredNow);
   assert.equal(result.membership.current.startAt.toISOString(),'2028-05-01T00:00:00.000Z');assert.equal(result.membership.version,3);
  });
  await t.test('inactive plans and inactive or archived member accounts cannot receive coverage',async()=>{
   await request(`/plans/${planId}`,{method:'PATCH',body:{active:false}});
   assert.equal((await request('/plans?status=active')).data.plans.length,0);
   assert.equal((await request(`/members/${other.id}`,{method:'POST',body:{planId,startDate:'2090-01-01'}})).status,409);
   await request(`/plans/${planId}`,{method:'PATCH',body:{active:true}});
   await User.updateOne({_id:other._id},{active:false});
   assert.equal((await request(`/members/${other.id}`,{method:'POST',body:{planId,startDate:'2090-01-01'}})).status,409);
   await User.updateOne({_id:other._id},{active:true,archivedAt:new Date()});
   assert.equal((await request(`/members/${other.id}`,{method:'POST',body:{planId,startDate:'2090-01-01'}})).status,409);
   await User.updateOne({_id:other._id},{archivedAt:null});
   assert.equal((await memberMembership(member.id,now)).membership.current.planName,fields.name);
  });
  await t.test('member self-service is scoped to token identity and hides audit fields',async()=>{
   const own=await request('/me',{auth:issueToken(member)});assert.equal(own.status,200);assert.equal(own.data.member.id,member.id);assert.equal(own.data.membership.history.length,3);
   assert.ok(!JSON.stringify(own.data).includes('recordedBy'));assert.ok(!JSON.stringify(own.data).includes('password'));
   assert.equal((await request('/me',{auth:issueToken(other)})).data.membership.status,'none');
   assert.equal((await request(`/members/${member.id}`,{auth:issueToken(other)})).status,403);
  });
  await t.test('directory and dashboard distinguish active, scheduled, expired; archived accounts excluded',async()=>{
   const scheduled=await make('member'),expired=await make('member');
   await enroll(scheduled.id,{planId,startAt:day('2028-07-01')},admin._id,now);
   await enroll(expired.id,{planId,startAt:day('2027-01-01')},admin._id,new Date('2027-01-01T00:00:00Z'));
   assert.deepEqual(await membershipStats(now),{available:true,active:1,scheduled:1,expired:1});
   const query={q:'',status:'active',page:1,limit:10};assert.equal((await listMemberships(query,now)).pagination.total,1);
   assert.equal((await listMemberships({...query,status:'all',limit:1,page:2},now)).memberships.length,1);
   assert.equal((await listMemberships({...query,status:'all',q:'.*'},now)).pagination.total,0);
   await User.updateOne({_id:scheduled._id},{archivedAt:now,active:false});assert.equal((await membershipStats(now)).scheduled,0);
   assert.equal((await memberMembership(scheduled.id,now)).membership.status,'scheduled');
  });
  await t.test('HTTP enrollment and renewal validate body fields and return coverage',async()=>{
   assert.equal((await request(`/members/${other.id}`,{method:'POST',body:{planId,startDate:'2090-01-01',priceMinor:1}})).status,400);
   const created=await request(`/members/${other.id}`,{method:'POST',body:{planId,startDate:'2090-01-01'}});assert.equal(created.status,201);assert.equal(created.data.membership.status,'scheduled');
   const renewed=await request(`/members/${other.id}/renew`,{method:'POST',body:{planId,expectedVersion:1}});assert.equal(renewed.status,200);assert.equal(renewed.data.membership.version,2);
   assert.equal((await request(`/members/${other.id}/renew`,{method:'POST',body:{planId}})).status,400);
   assert.equal((await Membership.findById(other.id)).periods.length,2);
  });
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(mongoose.connection.name===database)await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
});
