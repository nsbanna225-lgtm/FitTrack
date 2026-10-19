import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Trainer from '../src/models/Trainer.js';
import Member from '../src/models/Member.js';
import { issueToken } from '../src/services/tokenService.js';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const database = `fittrack_test_trainers_${randomUUID().replaceAll('-', '')}`;
test('trainer management with isolated MongoDB', { timeout: 60000 }, async t => {
 let server;
 try {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, { serverSelectionTimeoutMS: 5000 });
  await User.createIndexes();
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const make = role => User.create({name:`Test ${role}`,email:`${randomUUID()}@example.test`,role,passwordHash:'fixture-only'});
  const admin = await make('admin'), other = await make('trainer'), member = await make('member');
  const token = issueToken(admin);
  async function request(path = '', {method='GET',body,auth=token} = {}) {
   const response = await fetch(`${base}/api/trainers${path}`, {method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
   return {status:response.status,data:await response.json(),headers:response.headers};
  }
  let id;
  const fields={name:'Coach (A+)',email:' COACH@example.test ',password:'Trainer-password-2026!',phone:'+91 555'};
  await t.test('all trainer endpoints enforce admin access', async()=>{
   for(const [auth,status] of [[null,401],[issueToken(member),403],[issueToken(other),403]])
    for(const [path,method] of [['','GET'],['','POST'],[`/${other.id}`,'GET'],[`/${other.id}`,'PATCH'],[`/${other.id}/profile`,'PATCH'],[`/${other.id}/members`,'GET'],[`/${other.id}`,'DELETE'],[`/${other.id}/restore`,'POST']]) assert.equal((await request(path,{method,auth,body:['POST','PATCH'].includes(method)?fields:undefined})).status,status);
  });
  await t.test('creation forces trainer role, hashes passwords and rejects duplicate email',async()=>{
   const result=await request('',{method:'POST',body:fields});assert.equal(result.status,201);id=result.data.trainer.id;
   assert.equal(result.data.trainer.role,'trainer');assert.equal(result.data.trainer.email,'coach@example.test');assert.deepEqual(result.data.profile.availability,[]);
   assert.equal(result.headers.get('cache-control'),'no-store');assert.ok(!JSON.stringify(result.data).includes('passwordHash'));
   assert.notEqual((await User.findById(id).select('+passwordHash')).passwordHash,fields.password);
   assert.equal((await request('',{method:'POST',body:fields})).status,409);
   assert.equal((await request('',{method:'POST',body:{...fields,email:'inject@example.test',role:'admin'}})).status,400);
  });
  await t.test('directory search, pagination, and account validation',async()=>{
   assert.equal((await request('?q='+encodeURIComponent('(A+)'))).data.pagination.total,1);
   assert.equal((await request('?q=.*')).data.pagination.total,0);
   const first=await request('?limit=1&sort=name'),second=await request('?limit=1&sort=name&page=2');
   assert.equal(first.data.pagination.total,2);assert.notEqual(first.data.trainers[0].id,second.data.trainers[0].id);
   assert.equal((await request('?page=0')).status,400);assert.equal((await request('/bad-id')).status,400);assert.equal((await request(`/${member.id}`)).status,404);
   assert.equal((await request(`/${id}`,{method:'PATCH',body:{role:'admin'}})).status,400);
   assert.equal((await request(`/${id}`,{method:'PATCH',body:{email:admin.email}})).status,409);
   assert.equal((await request(`/${id}`,{method:'PATCH',body:{name:'Coach Updated'}})).data.trainer.name,'Coach Updated');
  });
  await t.test('profile validation rejects overlapping, malformed, and overnight intervals',async()=>{
   const bad=[{experienceYears:-1},{experienceYears:1.5},{experienceYears:'3'},{specializations:['']},{specializations:['a'.repeat(61)]},{bio:'x'.repeat(2001)},{timezone:'Mars/Base'},{role:'admin'},
    {availability:[{day:1,start:'10:00',end:'09:00'}]},{availability:[{day:7,start:'09:00',end:'10:00'}]},
    {availability:[{day:1,start:'24:00',end:'25:00'}]},
    {availability:[{day:1,start:'09:00',end:'12:00'},{day:1,start:'11:00',end:'13:00'}]},
    {availability:[{day:1,start:'09:00',end:'10:00',injected:true}]}];
   for(const body of bad) assert.equal((await request(`/${id}/profile`,{method:'PATCH',body})).status,400,JSON.stringify(body));
   assert.equal(await Trainer.countDocuments({_id:id}),0);
  });
  await t.test('profile persists normalized specializations and adjacent weekly hours',async()=>{
   const body={specializations:[' Strength ','strength','Mobility'],experienceYears:7,bio:'Experienced coach',timezone:'Asia/Kolkata',availability:[{day:2,start:'10:00',end:'11:00'},{day:1,start:'10:00',end:'11:00'},{day:1,start:'09:00',end:'10:00'}]};
   const saved=await request(`/${id}/profile`,{method:'PATCH',body});assert.equal(saved.status,200);assert.equal(saved.data.profile.specializations.length,2);
   assert.deepEqual(saved.data.profile.availability[0],{day:1,start:'09:00',end:'10:00'});
   assert.equal((await request(`/${id}/profile`,{method:'PATCH',body:{bio:'Updated'}})).data.profile.experienceYears,7);
   assert.equal(await Trainer.countDocuments({_id:id}),1);
  });
  await t.test('assigned member lists and workload exclude archived accounts and paginate',async()=>{
   await Member.create({_id:member._id,assignedTrainer:id});
   const inactive=await make('member'), archived=await make('member');
   await User.updateOne({_id:inactive._id},{active:false});await User.updateOne({_id:archived._id},{active:false,archivedAt:new Date()});
   await Member.create([{_id:inactive._id,assignedTrainer:id},{_id:archived._id,assignedTrainer:id}]);
   const detail=await request(`/${id}`);assert.deepEqual(detail.data.workload,{assignedMembers:2,activeMemberAccounts:1});assert.equal(detail.data.modules.sessions.available,true);
   const list=await request(`/${id}/members?limit=1`);assert.equal(list.data.pagination.total,2);assert.equal(list.data.members.length,1);
   assert.equal((await request(`/${id}/members?status=archived`)).data.pagination.total,1);
   assert.equal((await request(`/${id}/members?q=.*`)).data.pagination.total,0);
   assert.ok(!JSON.stringify(list.data).includes('notes'));
  });
  await t.test('deactivation revokes tokens and removes trainer from assignment options',async()=>{
   const old=issueToken(await User.findById(id).select('+tokenVersion'));
   await request(`/${id}`,{method:'PATCH',body:{active:false}});
   const options=await fetch(`${base}/api/members/trainers`,{headers:{Authorization:`Bearer ${token}`}});assert.ok(!(await options.json()).trainers.some(trainer=>trainer.id===id));
   const assignment=await fetch(`${base}/api/members/${member.id}/profile`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({assignedTrainer:id})});assert.equal(assignment.status,400);
   await request(`/${id}`,{method:'PATCH',body:{active:true}});
   assert.equal((await fetch(`${base}/api/auth/me`,{headers:{Authorization:`Bearer ${old}`}})).status,401);
  });
  await t.test('archive retains profiles and assignments, restore is inactive',async()=>{
   assert.equal((await request(`/${id}`,{method:'DELETE'})).status,200);
   assert.equal((await request()).data.pagination.total,1);assert.equal((await request('?status=archived')).data.trainers[0].id,id);
   assert.equal((await request(`/${id}`)).data.profile.bio,'Updated');assert.equal((await request(`/${id}`)).data.workload.assignedMembers,2);
   assert.equal((await request(`/${id}/profile`,{method:'PATCH',body:{bio:'No'}})).status,409);
   assert.equal((await request(`/${id}`,{method:'PATCH',body:{active:true}})).status,404);
   const dash=await fetch(`${base}/api/dashboard/admin`,{headers:{Authorization:`Bearer ${token}`}});assert.equal((await dash.json()).summary.totalTrainers,1);
   const restored=await request(`/${id}/restore`,{method:'POST'});assert.equal(restored.status,200);assert.equal(restored.data.trainer.active,false);
   assert.equal((await request(`/${id}`)).data.profile.availability.length,3);
   assert.equal((await request(`/${id}/restore`,{method:'POST'})).status,404);
  });
 } finally {
  if(server) await new Promise(resolve=>server.close(resolve));
  if(mongoose.connection.name===database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
});
