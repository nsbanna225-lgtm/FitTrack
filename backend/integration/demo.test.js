import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import {seedDemo,demoDatabase,demoModels} from '../scripts/demo-data.js';
import User from '../src/models/User.js';
import Membership from '../src/models/Membership.js';
import Payment from '../src/models/Payment.js';
import Session from '../src/models/Session.js';
import Trainer from '../src/models/Trainer.js';
import {covered,withinHours} from '../src/services/sessionService.js';
import {candidates} from '../src/services/notificationService.js';
import {membershipView} from '../src/services/membershipService.js';
test('demo database names cannot target application/system databases',()=>{
 for(const name of ['fittrack','admin','fittrack_demo/other','fittrack_demo?x=1','FITTRACK_DEMO','fittrack_demo_']) assert.throws(()=>demoDatabase(name));
 assert.equal(demoDatabase(),'fittrack_demo');
});
test('demo seed creates coherent fixtures and preserves data on rerun',{timeout:30000},async t=>{
 const database=`fittrack_demo_test_${randomBytes(8).toString('hex')}`;
 const password=randomBytes(18).toString('hex'), now=new Date();
 try {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`,{serverSelectionTimeoutMS:5000});
  await t.test('unknown nonempty database is refused without removing its data',async()=>{
   await mongoose.connection.db.collection('sentinel').insertOne({_id:'keep',value:42});
   await assert.rejects(seedDemo({password,now}),/nonempty/);
   assert.equal((await mongoose.connection.db.collection('sentinel').findOne({_id:'keep'})).value,42);
   await mongoose.connection.db.collection('sentinel').deleteOne({_id:'keep'});
  });
  const result=await seedDemo({password,now});
  await t.test('all roles and feature records exist without exposing passwords',async()=>{
   assert.equal(result.counts.User,8);assert.equal(result.counts.Progress,5);assert.equal(result.counts.Session,3);assert.equal(result.counts.Payment,6);assert.equal(result.counts.WorkoutAssignment,1);
   assert.ok(!JSON.stringify(result).includes(password));
   const users=await User.find().select('+passwordHash');
   for(const user of users) assert.equal(await bcrypt.compare(password,user.passwordHash),true);
   assert.equal(users.filter(u=>!u.active).length,2);
  });
  await t.test('memberships, payments and session reservations agree',async()=>{
   const memberships=await Membership.find();
   assert.deepEqual(new Set(memberships.map(m=>membershipView(m,now).status)),new Set(['active','expired','scheduled']));
   for(const payment of await Payment.find()) {
    const membership=memberships.find(m=>m.id===String(payment.memberId));
    const period=membership.periods.find(p=>String(p._id)===String(payment.periodId));
    assert.ok(period);assert.equal(period.priceMinor,payment.amountMinor);
   }
   const session=await Session.findOne({status:'scheduled'});
   assert.equal(session.reservations.length,8);assert.equal(new Set(session.reservations).size,8);
   assert.equal(covered(await Membership.findById(session.memberId),session.startAt,session.endAt),true);
   assert.equal(withinHours(await Trainer.findById(session.trainerId),session.startAt,session.endAt),true);
  });
  await t.test('notifications derive from sample records',async()=>{
   const member=await User.findOne({email:'member@fittrack.example.test'});
   const kinds=(await candidates(member,new Date())).map(n=>n.kind);
   assert.ok(kinds.includes('booking'));assert.ok(kinds.includes('workout_update'));
   const renewal=await User.findOne({email:'renewal@fittrack.example.test'});
   const reminders=(await candidates(renewal,new Date())).map(n=>n.kind);
   assert.ok(reminders.includes('membership_expiry'));assert.ok(reminders.includes('payment_reminder'));
  });
  await t.test('rerun preserves edits, passwords, timestamps and counts',async()=>{
   await User.updateOne({email:'member@fittrack.example.test'},{$set:{name:'Edited Demo'}});
   const before=Object.fromEntries(await Promise.all(demoModels.map(async m=>[m.modelName,await m.countDocuments()])));
   const again=await seedDemo({password:randomBytes(18).toString('hex')});
   assert.equal(again.alreadySeeded,true);assert.equal(again.seededAt,result.seededAt);assert.deepEqual(again.counts,before);
   const member=await User.findOne({email:'member@fittrack.example.test'}).select('+passwordHash');
   assert.equal(member.name,'Edited Demo');assert.equal(await bcrypt.compare(password,member.passwordHash),true);
  });
 } finally {
  if(mongoose.connection.name===database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
});
