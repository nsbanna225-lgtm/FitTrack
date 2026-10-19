import User, { publicUser } from '../models/User.js';
import Member from '../models/Member.js';
import { AppError } from '../utils/AppError.js';
const serialize = user => ({ ...publicUser(user), active: user.active, archivedAt: user.archivedAt || null });
const missing = () => { throw new AppError(404, 'Member not found.'); };
export async function findMember(id) {
  const user = await User.findOne({ _id: id, role: 'member' });
  if (!user) missing();
  return user;
}
export async function listMembers({ q, status, sort, page, limit }) {
  const match = { role: 'member', archivedAt: status === 'archived' ? { $ne: null } : null };
  if (status === 'active' || status === 'inactive') match.active = status === 'active';
  if (q) {
    const literal = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    match.$or = ['name','email','phone'].map(key => ({ [key]: { $regex: literal, $options: 'i' } }));
  }
  const order = sort === 'name' ? { name: 1, _id: 1 } : { createdAt: sort === 'oldest' ? 1 : -1, _id: sort === 'oldest' ? 1 : -1 };
  const [result] = await User.aggregate([{ $match: match }, { $facet: {
    metadata: [{ $count: 'total' }],
    members: [{ $sort: order }, { $skip: (page - 1) * limit }, { $limit: limit },
      { $project: { _id: 0, id: { $toString: '$_id' }, name: 1, email: 1, phone: 1, active: 1, archivedAt: 1, createdAt: 1 } }],
  } }]).option({ maxTimeMS: 5000 });
  const total = result.metadata[0]?.total || 0;
  return { members: result.members, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
}
export async function memberDetail(id) {
  const user = await findMember(id);
  const profile = await Member.findById(id).populate({ path: 'assignedTrainer', select: 'name email active role' });
  const trainer = profile?.assignedTrainer;
  return { member: serialize(user), profile: { goals: profile?.goals || '', notes: profile?.notes || '',
    assignedTrainer: trainer ? { id: String(trainer._id), name: trainer.name, email: trainer.email, available: trainer.active && trainer.role === 'trainer' } : null },
    modules: { membership: { available: true }, attendance: { available: true }, payments: { available: true }, workouts: { available: true }, progress: { available: true } } };
}
export async function updateAccount(id, fields) {
  const update = { $set: fields };
  if ('active' in fields || 'email' in fields) {
    update.$inc = { tokenVersion: 1 };
    update.$unset = { resetTokenHash: 1, resetTokenExpiresAt: 1 };
  }
  const user = await User.findOneAndUpdate({ _id: id, role: 'member', archivedAt: null }, update, { returnDocument: 'after', runValidators: true });
  if (!user) throw new AppError(404, 'Member not found or archived.');
  return serialize(user);
}
export async function updateMemberProfile(id, fields) {
  const user = await findMember(id);
  if (user.archivedAt) throw new AppError(409, 'Restore this member before editing their profile.');
  if (fields.assignedTrainer && !await User.exists({ _id: fields.assignedTrainer, role: 'trainer', active: true, archivedAt: null })) throw new AppError(400, 'Choose an active trainer.');
  await Member.findOneAndUpdate({ _id: id }, { $set: fields }, { upsert: true, runValidators: true });
  return memberDetail(id);
}
export async function archiveMember(id) {
  const user = await User.findOneAndUpdate({ _id: id, role: 'member', archivedAt: null }, {
    $set: { active: false, archivedAt: new Date() }, $inc: { tokenVersion: 1 }, $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 },
  }, { returnDocument: 'after' });
  if (!user) throw new AppError(404, 'Member not found or already archived.');
  return serialize(user);
}
export async function restoreMember(id) {
  const user = await User.findOneAndUpdate({ _id: id, role: 'member', archivedAt: { $ne: null } }, { $set: { archivedAt: null, active: false }, $inc: { tokenVersion: 1 } }, { returnDocument: 'after' });
  if (!user) throw new AppError(404, 'Archived member not found.');
  return serialize(user);
}
export async function trainerOptions() {
  return User.find({ role: 'trainer', active: true, archivedAt: null }).select('_id name email').sort({ name: 1, _id: 1 }).lean();
}
