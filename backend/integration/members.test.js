import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Member from '../src/models/Member.js';
import { issueToken } from '../src/services/tokenService.js';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const database = `fittrack_test_members_${randomUUID().replaceAll('-', '')}`;
test('member management with isolated MongoDB', { timeout: 60000 }, async t => {
 let server;
 try {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, { serverSelectionTimeoutMS: 5000 });
  await User.createIndexes();
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const make = role => User.create({name: `Test ${role}`, email: `${randomUUID()}@example.test`, role, passwordHash: 'fixture-only', tokenVersion: 0});
  const admin = await make('admin'), trainer = await make('trainer'), other = await make('member');
  const adminToken = issueToken(admin);
  async function request(path = '', { method = 'GET', body, token = adminToken } = {}) {
   const res = await fetch(`${base}/api/members${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
   return { status:res.status, data:await res.json(), headers:res.headers };
  }
  let id;
  const fields = {name:'Zara (A+)',email:' Zara@example.test ',password:'Member-test-password-2026!',phone:'+91 12345'};
  await t.test('every endpoint requires admin access', async () => {
   for (const [token,status] of [[null,401],[issueToken(trainer),403],[issueToken(other),403]])
    for (const [path,method] of [['','GET'],['','POST'],['/trainers','GET'],[`/${other.id}`,'GET'],[`/${other.id}`,'PATCH'],[`/${other.id}`,'DELETE'],[`/${other.id}/profile`,'PATCH'],[`/${other.id}/restore`,'POST']]) assert.equal((await request(path,{method,token,body:['POST','PATCH'].includes(method)?fields:undefined})).status,status);
  });
  await t.test('create hashes passwords, normalizes email, and rejects duplicates and role injection', async () => {
   const result=await request('',{method:'POST',body:fields}); assert.equal(result.status,201); id=result.data.member.id;
   assert.equal(result.data.member.email,'zara@example.test'); assert.equal(result.data.member.role,'member');
   assert.equal(result.data.profile.assignedTrainer,null); assert.equal(result.headers.get('cache-control'),'no-store');
   assert.equal(await Member.countDocuments({_id:id}),0);
   assert.notEqual((await User.findById(id).select('+passwordHash')).passwordHash,fields.password);
   assert.ok(!JSON.stringify(result.data).includes('passwordHash'));
   assert.equal((await request('',{method:'POST',body:fields})).status,409);
   assert.equal((await request('',{method:'POST',body:{...fields,email:'inject@example.test',role:'admin'}})).status,400);
  });
  await t.test('literal search and stable pagination exclude staff and private fields', async () => {
   const result=await request(`?q=${encodeURIComponent('(A+)')}`); assert.equal(result.data.pagination.total,1); assert.equal(result.data.members[0].id,id);
   assert.equal((await request('?q=.*')).data.pagination.total,0); assert.equal((await request('?q=%2B91')).data.pagination.total,1);
   const first=await request('?limit=1&sort=name'), second=await request('?limit=1&sort=name&page=2');
   assert.equal(first.data.pagination.total,2); assert.notEqual(first.data.members[0].id,second.data.members[0].id);
   assert.deepEqual(Object.keys(first.data.members[0]).sort(),['active','archivedAt','createdAt','email','id','name','phone']);
   assert.equal((await request('?limit=1&page=3')).data.members.length,0);
  });
  await t.test('invalid IDs, queries, operator injection, and protected fields are rejected', async () => {
   for(const query of ['?limit=0','?limit=51','?page=-1','?page=1.5','?q=a&q=b','?sort=passwordHash','?status=paid','?q[$ne]=a']) assert.equal((await request(query)).status,400);
   assert.equal((await request('/not-an-id')).status,400); assert.equal((await request(`/${trainer.id}`)).status,404);
   for(const body of [{role:'admin'},{active:'false'},{password:'injected'},{name:{$ne:null}},{},[]]) assert.equal((await request(`/${id}`,{method:'PATCH',body})).status,400);
   assert.equal((await request(`/${trainer.id}`,{method:'DELETE'})).status,404);
  });
  await t.test('account updates validate fields and preserve unique emails', async () => {
   const updated=await request(`/${id}`,{method:'PATCH',body:{name:'Zara Updated',phone:'1234'}});
   assert.equal(updated.status,200); assert.equal(updated.data.member.name,'Zara Updated');
   assert.equal((await request(`/${id}`,{method:'PATCH',body:{email:admin.email}})).status,409);
  });
  await t.test('coaching profile accepts only active trainers, validates notes, and preserves a single profile', async () => {
   assert.equal((await request('/trainers')).data.trainers.length,1);
   assert.equal((await request(`/${id}/profile`,{method:'PATCH',body:{assignedTrainer:admin.id}})).status,400);
   const saved=await request(`/${id}/profile`,{method:'PATCH',body:{assignedTrainer:trainer.id,goals:'Build consistency',notes:'Admin note'}});
   assert.equal(saved.status,200); assert.equal(saved.data.profile.assignedTrainer.id,trainer.id); assert.equal(await Member.countDocuments({_id:id}),1);
   await User.updateOne({_id:trainer.id},{active:false});
   assert.equal((await request(`/${id}/profile`,{method:'PATCH',body:{assignedTrainer:trainer.id}})).status,400);
   assert.equal((await request('/trainers')).data.trainers.length,0);
   assert.equal((await request(`/${id}/profile`,{method:'PATCH',body:{notes:'Changed'}})).status,200);
   assert.equal((await request(`/${id}/profile`,{method:'PATCH',body:{assignedTrainer:null}})).data.profile.assignedTrainer,null);
   assert.equal((await request(`/${id}/profile`,{method:'PATCH',body:{notes:'x'.repeat(2001)}})).status,400);
  });
  await t.test('deactivation revokes tokens permanently through reactivation', async () => {
   const token=issueToken(await User.findById(id).select('+tokenVersion'));
   assert.equal((await request(`/${id}`,{method:'PATCH',body:{active:false}})).status,200);
   assert.equal((await request('?status=inactive')).data.pagination.total,1);
   assert.equal((await request(`/${id}`,{method:'PATCH',body:{active:true}})).status,200);
   assert.equal((await fetch(`${base}/api/auth/me`,{headers:{Authorization:`Bearer ${token}`}})).status,401);
  });
  await t.test('archive retains history, excludes dashboard, blocks edits and restore stays inactive', async () => {
   assert.equal((await request(`/${id}`,{method:'DELETE'})).status,200);
   assert.equal((await request()).data.pagination.total,1); assert.equal((await request('?status=archived')).data.members[0].id,id);
   assert.equal((await request(`/${id}`)).data.profile.notes,'Changed');
   assert.equal((await request(`/${id}`,{method:'PATCH',body:{active:true}})).status,404);
   assert.equal((await request(`/${id}/profile`,{method:'PATCH',body:{notes:'bad'}})).status,409);
   const dashboard=await fetch(`${base}/api/dashboard/admin`,{headers:{Authorization:`Bearer ${adminToken}`}});
   assert.equal((await dashboard.json()).summary.totalMembers,1);
   assert.equal((await request('',{method:'POST',body:fields})).status,409);
   const restored=await request(`/${id}/restore`,{method:'POST'});
   assert.equal(restored.status,200); assert.equal(restored.data.member.active,false); assert.equal(restored.data.member.archivedAt,null);
   assert.equal((await request(`/${id}`)).data.profile.notes,'Changed');
   assert.equal((await request(`/${id}/restore`,{method:'POST'})).status,404);
  });
 } finally {
  if(server) await new Promise(resolve=>server.close(resolve));
  if(mongoose.connection.name===database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
});
