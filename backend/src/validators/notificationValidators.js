import { AppError } from '../utils/AppError.js';
export { id } from './membershipValidators.js';
export const kinds = ['booking', 'session_reminder', 'membership_expiry', 'payment_reminder', 'workout_update'];
const bad = () => { throw new AppError(400, 'Provide only valid notification fields.'); };
export function list(query) {
  if (Object.keys(query).some(key => !['page', 'status', 'kind'].includes(key)) || Object.values(query).some(value => typeof value !== 'string')) bad();
  if (query.page !== undefined && !/^[1-9][0-9]{0,5}$/.test(query.page)) bad();
  const status = query.status || 'all', kind = query.kind || 'all';
  if (!['all', 'unread', 'read'].includes(status) || !['all', ...kinds].includes(kind)) bad();
  return { page: Number(query.page || 1), status, kind };
}
export function read(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.read !== 'boolean') bad();
  return body.read;
}
export function empty(query) { if (Object.keys(query).length) bad(); }
