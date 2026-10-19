import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import User, { publicUser } from '../models/User.js';
import { issueToken } from './tokenService.js';
import { AppError } from '../utils/AppError.js';

const COST = 12;
// Equivalent-cost comparison avoids a fast path for unknown accounts.
const dummyHash = await bcrypt.hash(randomBytes(32).toString('hex'), COST);
const hashResetToken = (token) => createHash('sha256').update(token).digest('hex');
export const passwordHash = (password) => bcrypt.hash(password, COST);

export async function createUser(fields) {
  const { password, ...details } = fields;
  return User.create({ ...details, passwordHash: await passwordHash(password) });
}
export function sessionResponse(user) {
  return { user: publicUser(user), accessToken: issueToken(user), tokenType: 'Bearer', expiresIn: 900 };
}
export async function loginUser({ email, password, role }) {
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  const valid = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user || !valid || !user.active) throw new AppError(401, 'Invalid email or password.');
  if (role !== user.role) throw new AppError(403, 'Selected role does not match this account.');
  return sessionResponse(user);
}
export async function changeUserPassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash +tokenVersion');
  if (!user || !user.active || !await bcrypt.compare(currentPassword, user.passwordHash)) throw new AppError(401, 'Current password is incorrect.');
  const result = await User.updateOne({ _id: userId, passwordHash: user.passwordHash, tokenVersion: user.tokenVersion, active: true }, {
    $set: { passwordHash: await passwordHash(newPassword) },
    $inc: { tokenVersion: 1 }, $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 },
  });
  if (!result.modifiedCount) throw new AppError(409, 'Account changed. Please log in again.');
}

// A future email adapter receives { email, token, expiresInMinutes }.
// Until delivery is configured, fail uniformly rather than pretend an email was sent.
export async function requestPasswordReset(email, deliver = null) {
  if (!deliver) throw new AppError(503, 'Password reset delivery is not configured yet.');
  const user = await User.findOne({ email, active: true });
  if (!user) return;
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  await User.updateOne({ _id: user._id, active: true }, {
    $set: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });
  try { await deliver({ email: user.email, token, expiresInMinutes: 15 }); }
  catch {
    await User.updateOne({ _id: user._id, resetTokenHash: tokenHash }, { $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 } });
    throw new AppError(503, 'Password reset delivery is temporarily unavailable.');
  }
}
export async function resetUserPassword({ token, password }) {
  const tokenHash = hashResetToken(token);
  const eligible = { resetTokenHash: tokenHash, resetTokenExpiresAt: { $gt: new Date() }, active: true };
  if (!await User.exists(eligible)) throw new AppError(400, 'Reset token is invalid or expired.');
  const hash = await passwordHash(password);
  const updated = await User.findOneAndUpdate({ ...eligible, resetTokenExpiresAt: { $gt: new Date() } }, {
    $set: { passwordHash: hash }, $inc: { tokenVersion: 1 },
    $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 },
  });
  if (!updated) throw new AppError(400, 'Reset token is invalid or expired.');
}
