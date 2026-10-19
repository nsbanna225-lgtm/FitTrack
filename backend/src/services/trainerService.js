import User, { publicUser } from '../models/User.js';
import Trainer from '../models/Trainer.js';
import Member from '../models/Member.js';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
const serialize = user => ({ ...publicUser(user), active: user.active, archivedAt: user.archivedAt || null });
const missing = () => { throw new AppError(404, 'Trainer not found.'); };
export async function findTrainer(id) {
  const user = await User.findOne({ _id: id, role: 'trainer' });
  if (!user) missing();
  return user;
}
export async function listTrainers({ q, status, sort, page, limit }) {
  const match = { role: 'trainer', archivedAt: status === 'archived' ? { $ne: null } : null };
  if (status === 'active' || status === 'inactive') match.active = status === 'active';
  if (q) {
    const literal = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    match.$or = ['name','email','phone'].map(key => ({ [key]: { $regex: literal, $options: 'i' } }));
  }
  const order = sort === 'name' ? { name: 1, _id: 1 } : { createdAt: sort === 'oldest' ? 1 : -1, _id: sort === 'oldest' ? 1 : -1 };
  const [result] = await User.aggregate([{ $match: match }, { $facet: {
    metadata: [{ $count: 'total' }],
    trainers: [{ $sort: order }, { $skip: (page - 1) * limit }, { $limit: limit },
      { $project: { _id: 0, id: { $toString: '$_id' }, name: 1, email: 1, phone: 1, active: 1, archivedAt: 1, createdAt: 1 } }],
  } }]).option({ maxTimeMS: 5000 });
  const total = result.metadata[0]?.total || 0;
  return { trainers: result.trainers, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
}
export async function updateAccount(id, fields) {
  const update = { $set: fields };
  if ('active' in fields || 'email' in fields) {
    update.$inc = { tokenVersion: 1 };
    update.$unset = { resetTokenHash: 1, resetTokenExpiresAt: 1 };
  }
  const user = await User.findOneAndUpdate({ _id: id, role: 'trainer', archivedAt: null }, update, { returnDocument: 'after', runValidators: true });
  if (!user) throw new AppError(404, 'Trainer not found or archived.');
  return serialize(user);
}
export async function archiveTrainer(id) {
  const user = await User.findOneAndUpdate({ _id: id, role: 'trainer', archivedAt: null }, {
    $set: { active: false, archivedAt: new Date() }, $inc: { tokenVersion: 1 }, $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 },
  }, { returnDocument: 'after' });
  if (!user) throw new AppError(404, 'Trainer not found or already archived.');
  return serialize(user);
}
export async function restoreTrainer(id) {
  const user = await User.findOneAndUpdate({ _id: id, role: 'trainer', archivedAt: { $ne: null } }, { $set: { archivedAt: null, active: false }, $inc: { tokenVersion: 1 } }, { returnDocument: 'after' });
  if (!user) throw new AppError(404, 'Archived trainer not found.');
  return serialize(user);
}

export async function assignedMembers(id, { q, status, sort, page, limit }) {
  await findTrainer(id);
  const match = { 'account.role': 'member', 'account.archivedAt': status === 'archived' ? { $ne: null } : null };
  if (status === 'active' || status === 'inactive') match['account.active'] = status === 'active';
  if (q) {
    const literal = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    match.$or = ['name','email','phone'].map(key => ({ [`account.${key}`]: { $regex: literal, $options: 'i' } }));
  }
  const order = sort === 'name' ? { 'account.name': 1, _id: 1 } : { 'account.createdAt': sort === 'oldest' ? 1 : -1, _id: sort === 'oldest' ? 1 : -1 };
  const [result] = await Member.aggregate([
    { $match: { assignedTrainer: new mongoose.Types.ObjectId(id) } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'account' } },
    { $unwind: '$account' }, { $match: match },
    { $facet: { metadata: [{ $count: 'total' }], members: [{ $sort: order }, { $skip: (page - 1) * limit }, { $limit: limit },
      { $project: { _id: 0, id: { $toString: '$_id' }, name: '$account.name', email: '$account.email', active: '$account.active', archivedAt: '$account.archivedAt' } }] } },
  ]).option({ maxTimeMS: 5000 });
  const total = result.metadata[0]?.total || 0;
  return { members: result.members, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
}
export async function trainerDetail(id) {
  const user = await findTrainer(id);
  const profile = await Trainer.findById(id).lean();
  const [counts] = await Member.aggregate([
    { $match: { assignedTrainer: user._id } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'account' } },
    { $unwind: '$account' }, { $match: { 'account.role': 'member', 'account.archivedAt': null } },
    { $group: { _id: null, assigned: { $sum: 1 }, active: { $sum: { $cond: ['$account.active', 1, 0] } } } },
  ]).option({ maxTimeMS: 5000 });
  return { trainer: serialize(user), profile: {
    specializations: profile?.specializations || [], experienceYears: profile?.experienceYears || 0,
    bio: profile?.bio || '', timezone: profile?.timezone || 'Asia/Kolkata', availability: profile?.availability || [],
  }, workload: { assignedMembers: counts?.assigned || 0, activeMemberAccounts: counts?.active || 0 },
    modules: { sessions: { available: true }, performance: { available: false } } };
}
export async function updateTrainerProfile(id, fields) {
  const user = await findTrainer(id);
  if (user.archivedAt) throw new AppError(409, 'Restore this trainer before editing their profile.');
  await Trainer.findOneAndUpdate({ _id: id }, { $set: fields }, { upsert: true, runValidators: true });
  return trainerDetail(id);
}
