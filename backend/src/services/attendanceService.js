import mongoose from 'mongoose';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
const pageSize = 10;
const literal = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pagination = (total, page) => ({ total, page, pages: Math.ceil(total / pageSize) });
const serialize = row => ({ id: String(row._id), memberId: String(row.memberId), memberName: row.memberName, day: row.day, checkedInAt: row.checkedInAt, source: row.source });
export function percentage(createdAt, from, to, attendedDays) {
  const start = [from, new Date(createdAt).toISOString().slice(0, 10)].sort().at(-1);
  const elapsedDays = Math.max(0, Math.round((Date.parse(to) - Date.parse(start)) / 86400000) + 1);
  return { attendedDays, elapsedDays, percentage: elapsedDays ? Math.round(attendedDays / elapsedDays * 1000) / 10 : null };
}
export async function checkIn(input, actor, now = new Date()) {
  const memberId = actor.role === 'member' ? actor.id : input.memberId;
  const member = await User.findOne({ _id: memberId, role: 'member', active: true, archivedAt: null }).lean();
  if (!member) throw new AppError(404, 'Active member not found.');
  try {
    return serialize(await Attendance.create({ memberId: member._id, memberName: member.name, day: now.toISOString().slice(0, 10), checkedInAt: now, recordedBy: actor.id, source: actor.role }));
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'Already checked in today (UTC).');
    throw error;
  }
}
export async function history(input, actor, now = new Date()) {
  const memberId = actor.role === 'member' ? actor.id : input.memberId;
  const filter = { day: { $gte: input.from, $lte: input.to }, ...(memberId ? { memberId } : {}), ...(input.q ? { memberName: { $regex: literal(input.q), $options: 'i' } } : {}) };
  let member;
  if (memberId) {
    member = await User.findOne({ _id: memberId, role: 'member' }).select('name createdAt').lean();
    if (!member) throw new AppError(404, 'Member not found.');
  }
  const [records, total, today] = await Promise.all([
    Attendance.find(filter).sort({ checkedInAt: -1, _id: -1 }).skip((input.page - 1) * pageSize).limit(pageSize).lean(),
    Attendance.countDocuments(filter),
    memberId ? Attendance.exists({ memberId, day: now.toISOString().slice(0, 10) }) : null,
  ]);
  // Search narrows history only; percentage always uses all of the member's check-ins.
  const days = member ? await Attendance.countDocuments({ memberId, day: filter.day }) : null;
  return { records: records.map(serialize), pagination: pagination(total, input.page), period: { from: input.from, to: input.to, timezone: 'UTC' },
    summary: member ? { memberName: member.name, ...percentage(member.createdAt, input.from, input.to, days), checkedInToday: Boolean(today) } : null };
}
export async function report(input) {
  const filter = { role: 'member', createdAt: { $lt: new Date(Date.parse(input.to) + 86400000) }, ...(input.memberId ? { _id: new mongoose.Types.ObjectId(input.memberId) } : {}), ...(input.q ? { name: { $regex: literal(input.q), $options: 'i' } } : {}) };
  const [members, total] = await Promise.all([
    User.find(filter).select('name createdAt active archivedAt').sort({ name: 1, _id: 1 }).skip((input.page - 1) * pageSize).limit(pageSize).lean(),
    User.countDocuments(filter),
  ]);
  const counts = await Attendance.aggregate([{ $match: { memberId: { $in: members.map(member => member._id) }, day: { $gte: input.from, $lte: input.to } } }, { $group: { _id: '$memberId', count: { $sum: 1 } } }]).option({ maxTimeMS: 5000 });
  return { records: members.map(member => ({ id: String(member._id), name: member.name, active: member.active && !member.archivedAt, ...percentage(member.createdAt, input.from, input.to, counts.find(row => String(row._id) === String(member._id))?.count || 0) })), pagination: pagination(total, input.page), period: { from: input.from, to: input.to, timezone: 'UTC' } };
}
export async function attendanceStats(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const [todayCount, monthCount] = await Promise.all([Attendance.countDocuments({ day: today }), Attendance.countDocuments({ day: { $gte: `${today.slice(0, 7)}-01`, $lte: today } })]);
  return { available: true, today: todayCount, month: monthCount };
}
