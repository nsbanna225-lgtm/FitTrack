import MembershipPlan from '../models/MembershipPlan.js';
import Membership from '../models/Membership.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
const DAY = 86400000;
export const utcToday = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const literal = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const publicPlan = p => ({ id: String(p._id), name:p.name, durationDays:p.durationDays, priceMinor:p.priceMinor, currency:p.currency, features:p.features, active:p.active });
export async function createPlan(fields) {
  try { return publicPlan(await MembershipPlan.create(fields)); }
  catch (err) { if (err.code === 11000) throw new AppError(409,'A plan with this name already exists.'); throw err; }
}
export async function updatePlan(id, fields) {
  try {
    const plan = await MembershipPlan.findByIdAndUpdate(id, { $set: fields }, { returnDocument:'after',runValidators:true });
    if (!plan) throw new AppError(404,'Plan not found.');
    return publicPlan(plan);
  } catch (err) { if (err.code === 11000) throw new AppError(409,'A plan with this name already exists.'); throw err; }
}
export async function listPlans({ q, status, page, limit }) {
  const match = {};
  if (q) match.name = { $regex:literal(q),$options:'i' };
  if (status !== 'all') match.active = status === 'active';
  const [result] = await MembershipPlan.aggregate([{ $match:match },{ $facet:{ metadata:[{ $count:'total' }], plans:[{ $sort:{name:1,_id:1} },{ $skip:(page-1)*limit },{ $limit:limit }] } }]);
  const total = result.metadata[0]?.total || 0;
  return { plans:result.plans.map(publicPlan),pagination:{total,page,limit,pages:Math.ceil(total/limit)} };
}
export function statusOf(period, now = new Date()) {
  return new Date(period.startAt) > now ? 'scheduled' : new Date(period.expiresAt) <= now ? 'expired' : 'active';
}
export function membershipView(doc, now = new Date()) {
  if (!doc) return { status:'none',version:0,current:null,next:null,latest:null,history:[] };
  const history = doc.periods.map(p => ({ id:String(p._id),planId:String(p.planId),planName:p.planName,durationDays:p.durationDays,priceMinor:p.priceMinor,currency:p.currency,features:p.features,startAt:p.startAt,expiresAt:p.expiresAt,recordedAt:p.recordedAt,status:statusOf(p,now) }));
  const current = history.find(p => p.status === 'active') || null;
  const next = history.find(p => p.status === 'scheduled') || null;
  return { status:current ? 'active' : next ? 'scheduled' : 'expired',version:doc.version,current,next,latest:history.at(-1),history:history.toReversed() };
}
async function memberAccount(id, write = false) {
  const member = await User.findOne({_id:id,role:'member'});
  if (!member) throw new AppError(404,'Member not found.');
  if (write && (member.archivedAt || !member.active)) throw new AppError(409,'Activate and restore the member account before enrolling or renewing.');
  return member;
}
export async function memberMembership(id, now = new Date()) {
  const member = await memberAccount(id);
  return { member:{id:String(member._id),name:member.name,active:member.active,archivedAt:member.archivedAt},membership:membershipView(await Membership.findById(id).lean(),now) };
}
async function periodFor(planId, startAt, actor, now) {
  const plan = await MembershipPlan.findOne({_id:planId,active:true});
  if (!plan) throw new AppError(409,'Choose an active membership plan.');
  return { planId:plan._id,planName:plan.name,durationDays:plan.durationDays,priceMinor:plan.priceMinor,currency:plan.currency,features:[...plan.features],startAt,expiresAt:new Date(startAt.getTime()+plan.durationDays*DAY),recordedAt:now,recordedBy:actor };
}
export async function enroll(id, fields, actor, now = new Date()) {
  await memberAccount(id,true);
  if (fields.startAt < utcToday(now)) throw new AppError(400,'Start date must be today or later in UTC.');
  const period = await periodFor(fields.planId,fields.startAt,actor,now);
  try { await Membership.create({_id:id,version:1,periods:[period]}); }
  catch (err) { if (err.code === 11000) throw new AppError(409,'This member already has a membership record. Refresh and use Renew.'); throw err; }
  return memberMembership(id,now);
}
export async function renew(id, fields, actor, now = new Date()) {
  await memberAccount(id,true);
  const doc = await Membership.findById(id).lean();
  if (!doc) throw new AppError(404,'Enroll this member before renewing.');
  if (doc.version !== fields.expectedVersion) throw new AppError(409,'Membership changed. Refresh before renewing again.');
  if (doc.periods.length >= 200) throw new AppError(409,'Membership history limit reached. Contact the administrator.');
  const startAt = new Date(Math.max(utcToday(now).getTime(),new Date(doc.periods.at(-1).expiresAt).getTime()));
  const period = await periodFor(fields.planId,startAt,actor,now);
  const result = await Membership.updateOne({_id:id,version:fields.expectedVersion},{ $push:{periods:period},$inc:{version:1} },{runValidators:true});
  if (!result.modifiedCount) throw new AppError(409,'Membership changed. Refresh before renewing again.');
  return memberMembership(id,now);
}
function directoryPipeline(now) {
  return [
    { $lookup:{from:'users',localField:'_id',foreignField:'_id',as:'member'} },{ $unwind:'$member' },
    { $match:{'member.role':'member','member.archivedAt':null} },
    { $set:{ current:{ $arrayElemAt:[{ $filter:{input:'$periods',as:'p',cond:{ $and:[{ $lte:['$$p.startAt',now] },{ $gt:['$$p.expiresAt',now] }] } } },0] }, next:{ $arrayElemAt:[{ $filter:{input:'$periods',as:'p',cond:{ $gt:['$$p.startAt',now] } } },0] },latest:{ $arrayElemAt:['$periods',-1] } } },
    { $set:{status:{ $cond:[{ $ifNull:['$current',false] },'active',{ $cond:[{ $ifNull:['$next',false] },'scheduled','expired'] }] }} },
  ];
}
export async function listMemberships({ q,status,page,limit }, now = new Date()) {
  const match = {};
  if (q) match.$or = ['member.name','member.email'].map(key => ({[key]:{$regex:literal(q),$options:'i'}}));
  if (status !== 'all') match.status = status;
  const [result] = await Membership.aggregate([...directoryPipeline(now),{ $match:match },{ $facet:{metadata:[{$count:'total'}],memberships:[{$sort:{'member.name':1,_id:1}},{$skip:(page-1)*limit},{$limit:limit},{$project:{_id:0,memberId:{$toString:'$_id'},name:'$member.name',email:'$member.email',accountActive:'$member.active',status:1,planName:{$ifNull:['$current.planName',{$ifNull:['$next.planName','$latest.planName']}]},startAt:{$ifNull:['$current.startAt',{$ifNull:['$next.startAt','$latest.startAt']}]},expiresAt:'$latest.expiresAt'}}]}}]).option({maxTimeMS:5000});
  const total=result.metadata[0]?.total || 0;
  return {memberships:result.memberships,pagination:{total,page,limit,pages:Math.ceil(total/limit)}};
}
export async function membershipStats(now = new Date()) {
  const rows=await Membership.aggregate([...directoryPipeline(now),{$group:{_id:'$status',count:{$sum:1}}}]).option({maxTimeMS:5000});
  return {available:true,active:rows.find(r=>r._id==='active')?.count || 0,scheduled:rows.find(r=>r._id==='scheduled')?.count || 0,expired:rows.find(r=>r._id==='expired')?.count || 0};
}
