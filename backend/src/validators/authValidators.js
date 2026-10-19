import { AppError } from '../utils/AppError.js';

function invalid(message) { throw new AppError(400, message); }
function bodyObject(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('A JSON object is required.');
  if (Object.keys(body).some((key) => !fields.includes(key))) invalid('Request contains unsupported fields.');
}
export function validateEmail(value) {
  if (typeof value !== 'string') invalid('A valid email address is required.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('A valid email address is required.');
  return email;
}
export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value, 'utf8') > 72 || value.includes('\0')) {
    invalid('Password must contain at least 12 characters and no more than 72 UTF-8 bytes, without null characters.');
  }
  return value;
}
function validateName(value) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 80) invalid('Name must contain 2 to 80 characters.');
  return value.trim();
}
function validatePhone(value) {
  if (typeof value !== 'string' || value.length > 25 || !/^[0-9+() .-]*$/.test(value)) invalid('Phone number is invalid.');
  return value.trim();
}
export function validateRegistration(body, staff = false, demo = false) {
  bodyObject(body, ['name', 'email', 'password', 'phone', 'role']);
  if (staff && !['admin', 'trainer'].includes(body.role)) invalid('Staff role must be admin or trainer.');
  const role = body.role === undefined && !demo ? 'member' : body.role;
  if (!staff && !['member', 'trainer', 'admin'].includes(role)) invalid('Select a valid role.');
  if (!staff && !demo && role !== 'member') invalid('Public registration is limited to Member accounts.');
  return { name: validateName(body.name), email: validateEmail(body.email), password: validatePassword(body.password),
    phone: body.phone === undefined ? '' : validatePhone(body.phone), role: staff ? body.role : role };
}
export function validateLogin(body) {
  bodyObject(body, ['email', 'password', 'role']);
  const email = validateEmail(body.email);
  if (typeof body.password !== 'string' || !body.password.length || Buffer.byteLength(body.password, 'utf8') > 72) invalid('Password is required and must not exceed 72 UTF-8 bytes.');
  if (!['member', 'trainer', 'admin'].includes(body.role)) invalid('Select a valid role.');
  return { email, password: body.password, role: body.role };
}
export function validateProfile(body) {
  bodyObject(body, ['name', 'phone']);
  if (!Object.keys(body).length) invalid('Provide a name or phone number.');
  const fields = {};
  if (body.name !== undefined) fields.name = validateName(body.name);
  if (body.phone !== undefined) fields.phone = validatePhone(body.phone);
  return fields;
}
export function validatePasswordChange(body) {
  bodyObject(body, ['currentPassword', 'newPassword']);
  if (typeof body.currentPassword !== 'string' || !body.currentPassword.length || Buffer.byteLength(body.currentPassword) > 72) invalid('Current password is required.');
  return { currentPassword: body.currentPassword, newPassword: validatePassword(body.newPassword) };
}
export function validateForgot(body) {
  bodyObject(body, ['email']);
  return { email: validateEmail(body.email) };
}
export function validateReset(body) {
  bodyObject(body, ['token', 'password']);
  if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) invalid('Reset token is invalid or expired.');
  return { token: body.token, password: validatePassword(body.password) };
}
