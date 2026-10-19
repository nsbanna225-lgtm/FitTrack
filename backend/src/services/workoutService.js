import Exercise from '../models/Exercise.js';
import WorkoutPlan from '../models/WorkoutPlan.js';
import WorkoutAssignment from '../models/WorkoutAssignment.js';
import Member from '../models/Member.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
const missing = () => { throw new AppError(404, 'Workout record not found.'); };
const stale = () => { throw new AppError(409, 'This workout changed. Refresh and try again.'); };
const ownerScope = actor => actor.role === 'admin' ? {} : { ownerId: actor._id };
const literal = q => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asId = value => String(value);
const exerciseView = row => ({ id: asId(row._id), name: row.name, instructions: row.instructions, active: row.active, version: row.version });
const planView = row => ({ ...exerciseView(row), items: row.items, ownerId: asId(row.ownerId) });
function assignmentView(row, detail = false) {
  return { id: asId(row._id), planId: asId(row.planId), planVersion: row.planVersion, memberId: asId(row.memberId), memberName: row.memberName,
    trainerName: row.trainerName, name: row.name, version: row.version, createdAt: row.createdAt, archivedAt: row.archivedAt,
    status: row.archived ? 'archived' : row.completedCount === row.itemCount ? 'completed' : 'active',
    completedCount: row.completedCount, itemCount: row.itemCount,
    ...(detail ? { instructions: row.instructions, items: row.items, completed: row.completed } : {}) };
}
async function paginate(Model, filter, page, view, select) {
  const [rows, total] = await Promise.all([
    Model.find(filter).select(select || '').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 10).limit(10).maxTimeMS(5000).lean(),
    Model.countDocuments(filter).maxTimeMS(5000),
  ]);
  return { records: rows.map(view), pagination: { total, page, pages: Math.ceil(total / 10), limit: 10 } };
}
async function assignedMemberIds(actor) {
  return Member.find({ assignedTrainer: actor._id }).distinct('_id');
}
async function assignmentScope(actor) {
  if (actor.role === 'member') return { memberId: actor._id };
  if (actor.role === 'trainer') return { memberId: { $in: await assignedMemberIds(actor) } };
  return {};
}
export async function listLibrary(kind, query, actor) {
  const filter = ownerScope(actor);
  if (actor.role === 'admin' && kind === 'exercises' && query.ownerId) filter.ownerId = query.ownerId;
  if (query.status !== 'all') filter.active = query.status === 'active';
  if (query.q) filter.name = { $regex: literal(query.q), $options: 'i' };
  return paginate(kind === 'exercises' ? Exercise : WorkoutPlan, filter, query.page, kind === 'exercises' ? exerciseView : planView);
}
export async function saveExercise(id, fields, actor) {
  const { expectedVersion, ...data } = fields;
  if (!id) return exerciseView(await Exercise.create({ ...data, ownerId: actor._id }));
  const existing = await Exercise.findOne({ _id: id, ...ownerScope(actor) });
  if (!existing) missing();
  const result = await Exercise.findOneAndUpdate({ _id: id, version: expectedVersion, ...ownerScope(actor) }, { $set: data, $inc: { version: 1 } }, { returnDocument: 'after', runValidators: true });
  if (!result) stale();
  return exerciseView(result);
}
export async function savePlan(id, fields, actor) {
  const { expectedVersion, items, ...data } = fields;
  let existing;
  if (id) { existing = await WorkoutPlan.findOne({ _id: id, ...ownerScope(actor) }); if (!existing) missing(); }
  // Admin edits of trainer plans must keep that trainer's exercise ownership.
  const ownerId = existing?.ownerId || actor._id;
  const exercises = await Exercise.find({ _id: { $in: items.map(i => i.exerciseId) }, ownerId, active: true }).lean();
  const indexed = new Map(exercises.map(e => [asId(e._id), e]));
  const snapshots = items.map(item => {
    const previous = existing?.items.find(row => asId(row.exerciseId) === item.exerciseId.toLowerCase());
    const exercise = indexed.get(item.exerciseId.toLowerCase()) || (previous && { name: previous.name, instructions: previous.exerciseInstructions });
    if (!exercise) throw new AppError(409, 'Choose active exercises owned by this plan’s creator.');
    return { ...item, name: exercise.name, exerciseInstructions: exercise.instructions };
  });
  if (!id) return planView(await WorkoutPlan.create({ ...data, items: snapshots, ownerId }));
  const updated = await WorkoutPlan.findOneAndUpdate({ _id: id, version: expectedVersion, ...ownerScope(actor) }, { $set: { ...data, items: snapshots }, $inc: { version: 1 } }, { returnDocument: 'after', runValidators: true });
  if (!updated) stale();
  return planView(updated);
}
export async function listMembers(query, actor) {
  const filter = { role: 'member', active: true, archivedAt: null };
  if (actor.role === 'trainer') filter._id = { $in: await assignedMemberIds(actor) };
  if (query.q) filter.name = { $regex: literal(query.q), $options: 'i' };
  return paginate(User, filter, query.page, row => ({ id: asId(row._id), name: row.name }), 'name');
}
export async function assign(planId, { memberId, expectedVersion }, actor) {
  const plan = await WorkoutPlan.findOne({ _id: planId, ...ownerScope(actor) }).lean();
  if (!plan) missing();
  if (!plan.active || plan.version !== expectedVersion) stale();
  if (actor.role === 'trainer' && !await Member.exists({ _id: memberId, assignedTrainer: actor._id })) missing();
  const member = await User.findOne({ _id: memberId, role: 'member', active: true, archivedAt: null });
  if (!member) throw new AppError(409, 'Choose an active member.');
  try {
    const row = await WorkoutAssignment.create({ planId, planVersion: plan.version, memberId, memberName: member.name, assignedBy: actor._id,
      trainerName: actor.name, name: plan.name, instructions: plan.instructions, items: plan.items, itemCount: plan.items.length,
      completed: plan.items.map(() => false) });
    return assignmentView(row, true);
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'This member already has this plan. Archive the previous assignment before assigning it again.');
    throw error;
  }
}
export async function listAssignments(query, actor) {
  const scope = await assignmentScope(actor);
  const filter = { $and: [scope, ...(query.memberId ? [{ memberId: query.memberId }] : [])] };
  if (query.status !== 'all') filter.archived = query.status === 'archived';
  if (query.status === 'completed') filter.$expr = { $eq: ['$completedCount', '$itemCount'] };
  if (query.status === 'active') filter.$expr = { $lt: ['$completedCount', '$itemCount'] };
  if (query.q) filter.$or = ['name', 'memberName'].map(key => ({ [key]: { $regex: literal(query.q), $options: 'i' } }));
  return paginate(WorkoutAssignment, filter, query.page, row => assignmentView(row), '-items -completed -instructions');
}
export async function detail(id, actor) {
  const row = await WorkoutAssignment.findOne({ _id: id, ...await assignmentScope(actor) }).lean();
  if (!row) missing();
  return assignmentView(row, true);
}
export async function complete(id, fields, actor) {
  const row = await WorkoutAssignment.findOne({ _id: id, memberId: actor._id });
  if (!row) missing();
  if (row.archived || row.version !== fields.expectedVersion) stale();
  if (fields.itemIndex >= row.items.length) throw new AppError(400, 'Exercise is not part of this assignment.');
  const completed = [...row.completed]; completed[fields.itemIndex] = fields.completed;
  const updated = await WorkoutAssignment.findOneAndUpdate({ _id: id, memberId: actor._id, archived: false, version: fields.expectedVersion }, {
    $set: { completed, completedCount: completed.filter(Boolean).length }, $inc: { version: 1 },
  }, { returnDocument: 'after', runValidators: true });
  if (!updated) stale();
  return assignmentView(updated, true);
}
export async function archive(id, { expectedVersion }, actor) {
  const scope = await assignmentScope(actor);
  if (!await WorkoutAssignment.exists({ _id: id, ...scope })) missing();
  const row = await WorkoutAssignment.findOneAndUpdate({ _id: id, ...scope, archived: false, version: expectedVersion }, {
    $set: { archived: true, archivedAt: new Date(), archivedBy: actor._id }, $inc: { version: 1 },
  }, { returnDocument: 'after' });
  if (!row) stale();
  return assignmentView(row, true);
}
