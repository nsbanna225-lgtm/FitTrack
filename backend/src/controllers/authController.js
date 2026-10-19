import User, { publicUser } from '../models/User.js';
import * as validation from '../validators/authValidators.js';
import * as auth from '../services/authService.js';
import { AppError } from '../utils/AppError.js';
import { readRegistrationOptions } from '../config/env.js';

export function registrationOptions(_req, res) { res.json(readRegistrationOptions()); }

export async function register(req, res) {
  const user = await auth.createUser(validation.validateRegistration(req.body, false, readRegistrationOptions().demo));
  res.status(201).json({ user: publicUser(user), message: 'Account created successfully. Please sign in.' });
}
export async function login(req, res) {
  res.json(await auth.loginUser(validation.validateLogin(req.body)));
}
export function me(req, res) { res.json({ user: publicUser(req.user) }); }
export async function updateProfile(req, res) {
  const fields = validation.validateProfile(req.body);
  const user = await User.findOneAndUpdate({ _id: req.user._id, active: true }, { $set: fields }, { returnDocument: 'after', runValidators: true });
  if (!user) throw new AppError(401, 'Session is invalid or expired. Please log in again.');
  res.json({ user: publicUser(user) });
}
export async function logout(req, res) {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.json({ message: 'Logged out from all devices.' });
}
export async function changePassword(req, res) {
  await auth.changeUserPassword(req.user._id, validation.validatePasswordChange(req.body));
  res.json({ message: 'Password updated. Please log in again on all devices.' });
}
export async function createStaff(req, res) {
  const user = await auth.createUser(validation.validateRegistration(req.body, true));
  res.status(201).json({ user: publicUser(user) });
}
export async function forgotPassword(req, res) {
  const { email } = validation.validateForgot(req.body);
  await auth.requestPasswordReset(email);
  res.json({ message: 'If this email is registered, password reset instructions will be sent.' });
}
export async function resetPassword(req, res) {
  await auth.resetUserPassword(validation.validateReset(req.body));
  res.json({ message: 'Password reset. Please log in again.' });
}
