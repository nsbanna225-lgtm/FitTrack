import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../src/models/User.js';
import Member from '../src/models/Member.js';
import Trainer from '../src/models/Trainer.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import Membership from '../src/models/Membership.js';
import Payment from '../src/models/Payment.js';
import Session from '../src/models/Session.js';
import Attendance from '../src/models/Attendance.js';
import Progress from '../src/models/Progress.js';
import Exercise from '../src/models/Exercise.js';
import WorkoutPlan from '../src/models/WorkoutPlan.js';
import WorkoutAssignment from '../src/models/WorkoutAssignment.js';
import { validatePassword } from '../src/validators/authValidators.js';

export const demoModels = [User, Member, Trainer, MembershipPlan, Membership, Payment, Session, Attendance, Progress, Exercise, WorkoutPlan, WorkoutAssignment];
export function demoDatabase(value = 'fittrack_demo') {
  if (typeof value !== 'string' || !/^fittrack_demo(?:_[a-z0-9]+)*$/.test(value) || value.length > 60) throw new Error('Use fittrack_demo or fittrack_demo_<lowercase suffix>.');
  return value;
}
export async function seedDemo({ password, now = new Date() }) {
  demoDatabase(mongoose.connection.name);
  validatePassword(password);
  if (!Number.isFinite(+now)) throw new Error('Invalid demo date.');
  const db = mongoose.connection.db;
  const runs = db.collection('demo_seed_runs');
  const existing = await runs.findOne({_id:'v1'});
  if (existing?.status === 'complete') return {...existing.summary, alreadySeeded:true};
  if (existing) throw new Error('An incomplete seed exists. Use a fresh demo database suffix.');
  // Never merge fixtures into unknown data, including collections outside the models.
  for (const {name} of await db.listCollections().toArray()) {
    if (await db.collection(name).findOne({})) throw new Error('Refusing a nonempty database without a completed demo seed.');
  }
  // The fixed ID prevents two seeders from writing concurrently.
  await runs.insertOne({_id:'v1',status:'running',startedAt:now});
  try {
    await Promise.all(demoModels.map(model=>model.init()));
    const passwordHash = await bcrypt.hash(password,12);
    const DAY=86400000, today = new Date(now); today.setUTCHours(0,0,0,0);
    const at = days => new Date(+today + days*DAY);
    const account = (name,email,role,days,extra={}) => User.create({name,email:`${email}@fittrack.example.test`,role,passwordHash,createdAt:at(days),updatedAt:now,...extra});
    const admin=await account('Demo Admin','admin','admin',-90);
    const trainer=await account('Demo Trainer','trainer','trainer',-85);
    await Trainer.create({_id:trainer._id,specializations:['General fitness','Mobility'],experienceYears:5,bio:'Fictional demonstration trainer.',timezone:'UTC',availability:Array.from({length:7},(_,day)=>({day,start:'06:00',end:'22:00'}))});
    const members=[];
    for (const [name,email,days,extra] of [
      ['Demo Member','member',-60,{}],['Demo Renewal','renewal',-50,{}],['Demo Expired','expired',-45,{}],
      ['Demo Scheduled','scheduled',-20,{}],['Demo Inactive','inactive',-15,{active:false}],['Demo Archived','archived',-10,{active:false,archivedAt:at(-2)}],
    ]) {
      const user=await account(name,email,'member',days,extra); members.push(user);
      await Member.create({_id:user._id,assignedTrainer:trainer._id,goals:'Explore the demo workflow.',notes:'Fictional sample data.'});
    }
    const monthly=await MembershipPlan.create({name:'Demo Monthly',nameKey:'demo monthly',durationDays:30,priceMinor:149900,features:['Gym access','Workout tracking']});
    await MembershipPlan.create({name:'Demo Quarterly',nameKey:'demo quarterly',durationDays:90,priceMinor:399900,features:['Gym access','Trainer sessions']});
    await MembershipPlan.create({name:'Demo Retired Plan',nameKey:'demo retired plan',durationDays:30,priceMinor:99900,features:[],active:false});
    for (let i=0;i<members.length;i++) {
      const start=[-10,-26,-35,3,-10,-8][i];
      const recordedAt=at(Math.min(start,0));
      const membership=await Membership.create({_id:members[i]._id,periods:[{planId:monthly._id,planName:monthly.name,durationDays:30,priceMinor:monthly.priceMinor,currency:'INR',features:monthly.features,startAt:at(start),expiresAt:at(start+30),recordedAt,recordedBy:admin._id}]});
      const period=membership.periods[0], status=['paid','pending','failed','pending','paid','paid'][i];
      const paid=status==='paid';
      await Payment.create({memberId:members[i]._id,periodId:period._id,memberName:members[i].name,planName:monthly.name,startAt:period.startAt,expiresAt:period.expiresAt,amountMinor:monthly.priceMinor,status,paidAt:paid?recordedAt:null,version:status==='pending'?1:2,events:[{status:'pending',at:recordedAt,actorId:admin._id},...(status==='pending'?[]:[{status,at:recordedAt,actorId:admin._id}])]});
    }
    const member=members[0];
    for (let i=1;i<=8;i++) {
      const when=new Date(+at(-i)+9*3600000);
      await Attendance.create({memberId:member._id,memberName:member.name,day:when.toISOString().slice(0,10),checkedInAt:when,recordedBy:admin._id,source:'admin'});
    }
    for (let i=0;i<5;i++) await Progress.create({memberId:member._id,day:at(-28+i*7).toISOString().slice(0,10),weightKg:75-i*.4,heightCm:175,waistCm:84-i*.5,notes:'Fictional demonstration measurement, not a health recommendation.',recordedBy:member._id,updatedBy:member._id});
    const exercise=await Exercise.create({ownerId:trainer._id,name:'Demo bodyweight squat',instructions:'Fictional workout content for exploring the app.'});
    const items=[{exerciseId:exercise._id,name:exercise.name,exerciseInstructions:exercise.instructions,day:1,sets:3,reps:10,restSeconds:60},{exerciseId:exercise._id,name:exercise.name,exerciseInstructions:exercise.instructions,day:3,sets:2,reps:8,restSeconds:60}];
    const plan=await WorkoutPlan.create({ownerId:trainer._id,name:'Demo weekly routine',items,instructions:'Sample workout for interface demonstration.'});
    await WorkoutAssignment.create({planId:plan._id,planVersion:1,memberId:member._id,assignedBy:trainer._id,memberName:member.name,trainerName:trainer.name,name:plan.name,items,completed:[true,false],completedCount:1,itemCount:2});
    // Tomorrow at 10:00 UTC, inside both trainer availability and membership coverage.
    for (const [startAt,status] of [[new Date(+at(1)+10*3600000),'scheduled'],[new Date(+at(-2)+10*3600000),'completed'],[new Date(+at(-3)+10*3600000),'cancelled']]) {
      const endAt=new Date(+startAt+3600000), reservations=[];
      if(status==='scheduled') for(let time=+startAt;time<+endAt;time+=900000) reservations.push(`${trainer._id}:${time}`,`${member._id}:${time}`);
      await Session.create({trainerId:trainer._id,memberId:member._id,trainerName:trainer.name,memberName:member.name,timezone:'UTC',startAt,endAt,status,reservations,createdBy:admin._id,updatedBy:admin._id});
    }
    const counts=Object.fromEntries(await Promise.all(demoModels.map(async model=>[model.modelName,await model.countDocuments()])));
    const summary={database:mongoose.connection.name,seededAt:now.toISOString(),counts,accounts:[admin,trainer,...members].map(user=>({email:user.email,role:user.role,active:user.active}))};
    await runs.updateOne({_id:'v1'},{$set:{status:'complete',summary}});
    return {...summary,alreadySeeded:false};
  } catch(error) {
    await runs.updateOne({_id:'v1'},{$set:{status:'failed'}});
    throw error;
  }
}
