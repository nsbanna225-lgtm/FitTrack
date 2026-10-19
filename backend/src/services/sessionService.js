import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Trainer from '../models/Trainer.js';
import User from '../models/User.js';
import Membership from '../models/Membership.js';
import { AppError } from '../utils/AppError.js';

const STEP = 900000, DAY = 86400000;
const scope = actor => actor.role === 'admin' ? {} : { [actor.role === 'trainer' ? 'trainerId' : 'memberId']: actor._id };
const publicSession = s => ({ id: String(s._id), trainerId: String(s.trainerId), memberId: String(s.memberId), trainerName: s.trainerName, memberName: s.memberName, timezone: s.timezone, startAt: s.startAt, endAt: s.endAt, status: s.status, version: s.version });
function conflict(err) { if (err.code === 11000) throw new AppError(409, 'This trainer or member is already booked. Refresh available times.'); throw err; }
async function participants(trainerId, memberId) {
  const [trainer, member, profile, membership] = await Promise.all([
    User.findOne({ _id: trainerId, role: 'trainer', active: true, archivedAt: null }).lean(),
    User.findOne({ _id: memberId, role: 'member', active: true, archivedAt: null }).lean(),
    Trainer.findById(trainerId).lean(), Membership.findById(memberId).lean(),
  ]);
  if (!trainer || !member) throw new AppError(409, 'Choose active, non-archived trainer and member accounts.');
  if (!profile?.availability.length) throw new AppError(409, 'This trainer has no published working hours.');
  return { trainer, member, profile, membership };
}
function clock(timezone) {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return instant => {
    const p = Object.fromEntries(formatter.formatToParts(instant).map(v => [v.type, v.value]));
    const date = `${p.year}-${p.month}-${p.day}`;
    return { date, day: new Date(`${date}T00:00:00Z`).getUTCDay(), minute: Number(p.hour) * 60 + Number(p.minute) };
  };
}
const minutes = time => Number(time.slice(0,2)) * 60 + Number(time.slice(3));
export function withinHours(profile, startAt, endAt, local = clock(profile.timezone)) {
  const start = local(startAt), end = local(endAt), length = (+endAt - +startAt) / 60000;
  // Do not book across midnight or a DST clock jump. Repeated times remain distinct UTC slots.
  if (start.date !== end.date || end.minute - start.minute !== length) return false;
  return profile.availability.some(s => s.day === start.day && minutes(s.start) <= start.minute && minutes(s.end) >= end.minute);
}
export function covered(membership, startAt, endAt) {
  let through = +startAt;
  for (const p of membership?.periods || []) {
    if (+new Date(p.startAt) > through) break;
    if (+new Date(p.expiresAt) > through) through = +new Date(p.expiresAt);
    if (through >= +endAt) return true;
  }
  return false;
}
function future(startAt, now) {
  if (+startAt <= +now || +startAt > +now + 180 * DAY) throw new AppError(400, 'Book a future time within the next 180 days.');
}
function keys(trainerId, memberId, startAt, endAt) {
  const result = [];
  for (let time = +startAt; time < +endAt; time += STEP) result.push(`${trainerId}:${time}`, `${memberId}:${time}`);
  return result;
}
async function ownSession(id, actor) {
  const doc = await Session.findOne({ _id: id, ...scope(actor) }).lean();
  if (!doc) throw new AppError(404, 'Session not found.');
  return doc;
}
export async function book(fields, actor, now = new Date()) {
  const memberId = actor.role === 'admin' ? fields.memberId : String(actor._id);
  future(fields.startAt, now);
  const { trainer, member, profile, membership } = await participants(fields.trainerId, memberId);
  const endAt = new Date(+fields.startAt + fields.durationMinutes * 60000);
  if (!withinHours(profile, fields.startAt, endAt)) throw new AppError(409, 'Choose a time within the trainer’s published hours, without a daylight-saving transition.');
  if (!covered(membership, fields.startAt, endAt)) throw new AppError(409, 'Membership must cover the entire session. Enroll or renew first.');
  try {
    return publicSession(await Session.create({ trainerId: trainer._id, memberId: member._id, trainerName: trainer.name, memberName: member.name, timezone: profile.timezone, startAt: fields.startAt, endAt, reservations: keys(trainer._id, member._id, fields.startAt, endAt), createdBy: actor._id, updatedBy: actor._id }));
  } catch (err) { conflict(err); }
}
export async function reschedule(id, fields, actor, now = new Date()) {
  const doc = await ownSession(id, actor);
  if (doc.status !== 'scheduled' || +doc.startAt <= +now) throw new AppError(409, 'Only a future scheduled session can be rescheduled.');
  future(fields.startAt, now);
  const { profile, membership } = await participants(doc.trainerId, doc.memberId);
  const endAt = new Date(+fields.startAt + fields.durationMinutes * 60000);
  if (!withinHours(profile, fields.startAt, endAt)) throw new AppError(409, 'This time is outside the trainer’s working hours.');
  if (!covered(membership, fields.startAt, endAt)) throw new AppError(409, 'Membership must cover the entire session.');
  try {
    const updated = await Session.findOneAndUpdate({ _id: id, version: fields.expectedVersion, status: 'scheduled' }, { $set: { startAt: fields.startAt, endAt, timezone: profile.timezone, reservations: keys(doc.trainerId, doc.memberId, fields.startAt, endAt), updatedBy: actor._id }, $inc: { version: 1 } }, { returnDocument: 'after', runValidators: true });
    if (!updated) throw new AppError(409, 'Session changed. Refresh before trying again.');
    return publicSession(updated);
  } catch (err) { conflict(err); }
}
export async function changeStatus(id, expectedVersion, status, actor, now = new Date()) {
  const doc = await ownSession(id, actor);
  if (doc.status !== 'scheduled') throw new AppError(409, 'This session is already closed.');
  if (status === 'cancelled' && +doc.startAt <= +now) throw new AppError(409, 'Only future sessions can be cancelled.');
  if (status === 'completed' && +doc.endAt > +now) throw new AppError(409, 'A session can be completed only after it ends.');
  const updated = await Session.findOneAndUpdate({ _id: id, version: expectedVersion, status: 'scheduled' }, { $set: { status, reservations: [], updatedBy: actor._id }, $inc: { version: 1 } }, { returnDocument: 'after', runValidators: true });
  if (!updated) throw new AppError(409, 'Session changed. Refresh before trying again.');
  return publicSession(updated);
}
export async function listSessions(query, actor) {
  const match = { ...scope(actor), startAt: { $gte: query.from, $lt: query.to } };
  if (query.status !== 'all') match.status = query.status;
  if (query.trainerId) match.trainerId = new mongoose.Types.ObjectId(query.trainerId);
  if (query.memberId) match.memberId = new mongoose.Types.ObjectId(query.memberId);
  const [result] = await Session.aggregate([{ $match: match }, { $facet: { metadata: [{ $count: 'total' }], sessions: [{ $sort: { startAt: 1, _id: 1 } }, { $skip: (query.page - 1) * 10 }, { $limit: 10 }] } }]).option({ maxTimeMS: 5000 });
  const total = result.metadata[0]?.total || 0;
  return { sessions: result.sessions.map(publicSession), pagination: { total, page: query.page, pages: Math.ceil(total / 10) } };
}
export async function trainerOptions({ q, page }) {
  const literal = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = { role: 'trainer', active: true, archivedAt: null, ...(q ? { name: { $regex: literal, $options: 'i' } } : {}) };
  const [result] = await User.aggregate([{ $match: match }, { $lookup: { from: 'trainers', localField: '_id', foreignField: '_id', as: 'profile' } }, { $unwind: '$profile' }, { $match: { 'profile.availability.0': { $exists: true } } }, { $facet: { metadata: [{ $count: 'total' }], trainers: [{ $sort: { name: 1, _id: 1 } }, { $skip: (page - 1) * 10 }, { $limit: 10 }, { $project: { _id: 0, id: { $toString: '$_id' }, name: 1, timezone: '$profile.timezone', availability: '$profile.availability' } }] } }]).option({ maxTimeMS: 5000 });
  const total = result.metadata[0]?.total || 0;
  return { trainers: result.trainers, pagination: { total, page, pages: Math.ceil(total / 10) } };
}
export async function availableSlots(query, actor, now = new Date()) {
  const memberId = actor.role === 'admin' ? query.memberId : String(actor._id);
  if (query.excludeId) {
    const doc = await ownSession(query.excludeId, actor);
    if (String(doc.memberId) !== String(memberId) || String(doc.trainerId) !== query.trainerId) throw new AppError(400, 'The session participants cannot be changed.');
  }
  if (+query.date < +now - DAY || +query.date > +now + 181 * DAY) throw new AppError(400, 'Choose a date within the next 180 days.');
  const { profile, membership } = await participants(query.trainerId, memberId);
  const from = +query.date - 14 * 3600000, to = +query.date + 38 * 3600000;
  const occupied = await Session.find({ status: 'scheduled', $or: [{ trainerId: query.trainerId }, { memberId }], startAt: { $lt: new Date(to) }, endAt: { $gt: new Date(from) }, ...(query.excludeId ? { _id: { $ne: query.excludeId } } : {}) }).select('startAt endAt').lean();
  const local = clock(profile.timezone), date = query.date.toISOString().slice(0,10), slots = [];
  for (let time = from; time < to; time += STEP) {
    const startAt = new Date(time), endAt = new Date(time + query.durationMinutes * 60000);
    if (time <= +now || time > +now + 180 * DAY || local(startAt).date !== date) continue;
    if (withinHours(profile, startAt, endAt, local) && covered(membership, startAt, endAt) && !occupied.some(s => +s.startAt < +endAt && +s.endAt > time)) slots.push({ startAt, endAt });
  }
  return { timezone: profile.timezone, slots };
}
export async function upcomingSessions(now = new Date()) {
  const sessions = await Session.find({ status: 'scheduled', endAt: { $gt: now } }).sort({ startAt: 1, _id: 1 }).limit(5).lean();
  return { available: true, upcoming: sessions.map(publicSession) };
}
