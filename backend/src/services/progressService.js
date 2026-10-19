import Progress from '../models/Progress.js';
import User from '../models/User.js';
import Member from '../models/Member.js';
import WorkoutAssignment from '../models/WorkoutAssignment.js';
import { AppError } from '../utils/AppError.js';
const missing = () => { throw new AppError(404, 'Member progress not found.'); };
export const bmi = (weight, height) => height == null ? null : Math.round(weight / ((height / 100) ** 2) * 10) / 10;
const view = row => ({ id: String(row._id), day: row.day, weightKg: row.weightKg, heightCm: row.heightCm, waistCm: row.waistCm, chestCm: row.chestCm, hipsCm: row.hipsCm, bmi: bmi(row.weightKg, row.heightCm), notes: row.notes, version: row.version, createdAt: row.createdAt, updatedAt: row.updatedAt });
async function access(memberId, actor, write = false) {
  if (actor.role === 'member' && String(actor._id) !== memberId.toLowerCase()) missing();
  if (actor.role === 'trainer' && !await Member.exists({ _id: memberId, assignedTrainer: actor._id })) missing();
  const member = await User.findOne({ _id: memberId, role: 'member' }).select('name active archivedAt').lean();
  if (!member) missing();
  if (write && (!member.active || member.archivedAt)) throw new AppError(409, 'Activate and restore the member before recording progress.');
  return member;
}
export async function save(memberId, entryId, fields, actor) {
  await access(memberId, actor, true);
  const { expectedVersion, ...data } = fields;
  try {
    if (!entryId) return view(await Progress.create({ ...data, memberId, recordedBy: actor._id, updatedBy: actor._id }));
    if (!await Progress.exists({ _id: entryId, memberId })) missing();
    const updated = await Progress.findOneAndUpdate({ _id: entryId, memberId, version: expectedVersion }, { $set: { ...data, updatedBy: actor._id }, $inc: { version: 1 } }, { returnDocument: 'after', runValidators: true }).lean();
    if (!updated) throw new AppError(409, 'This entry changed. Close the form and refresh before editing again.');
    return view(updated);
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'A measurement already exists for this UTC date. Edit that entry instead.');
    throw error;
  }
}
export async function history(memberId, input, actor) {
  const member = await access(memberId, actor);
  const rows = await Progress.find({ memberId, day: { $gte: input.from, $lte: input.to } }).sort({ day: 1 }).maxTimeMS(5000).lean();
  // At most 366 daily entries. Charts and summary cover the whole filter, not just the visible page.
  const records = rows.map(view);
  const workouts = await WorkoutAssignment.aggregate([
    { $match: { memberId: member._id, createdAt: { $gte: new Date(input.from), $lt: new Date(Date.parse(input.to) + 86400000) } } },
    { $group: { _id: null, assignments: { $sum: 1 }, completed: { $sum: '$completedCount' }, items: { $sum: '$itemCount' } } },
  ]).option({ maxTimeMS: 5000 });
  const workout = workouts[0] || { assignments: 0, completed: 0, items: 0 };
  return { member: { id: String(member._id), name: member.name, editable: actor.role !== 'trainer' && member.active && !member.archivedAt },
    records: [...records].reverse().slice((input.page - 1) * 10, input.page * 10),
    pagination: { total: records.length, page: input.page, pages: Math.ceil(records.length / 10) }, period: { from: input.from, to: input.to, timezone: 'UTC' },
    trend: records.map(({ day, weightKg, bmi, waistCm, chestCm, hipsCm }) => ({ day, weightKg, bmi, waistCm, chestCm, hipsCm })),
    summary: { latest: records.at(-1) || null, weightChangeKg: records.length > 1 ? Math.round((records.at(-1).weightKg - records[0].weightKg) * 10) / 10 : null,
      workout: { assignments: workout.assignments, completed: workout.completed, items: workout.items, percentage: workout.items ? Math.round(workout.completed / workout.items * 1000) / 10 : null } } };
}
