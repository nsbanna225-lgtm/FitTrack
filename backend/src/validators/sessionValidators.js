import { AppError } from '../utils/AppError.js';
import { id, day } from './membershipValidators.js';
export { id };
const bad = message => { throw new AppError(400, message); };
function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) bad('Provide only supported fields.');
}
export function duration(value) {
  if (!Number.isInteger(value) || value < 15 || value > 180 || value % 15) bad('Duration must be 15–180 minutes in 15-minute steps.');
  return value;
}
function version(value) {
  if (!Number.isSafeInteger(value) || value < 1) bad('Refresh the schedule and provide its current version.');
  return value;
}
export function booking(body, role, editing = false) {
  fields(body, editing ? ['startAt', 'durationMinutes', 'expectedVersion'] : role === 'admin' ? ['trainerId', 'memberId', 'startAt', 'durationMinutes'] : ['trainerId', 'startAt', 'durationMinutes']);
  if (typeof body.startAt !== 'string' || !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(body.startAt)) bad('Choose an available session time.');
  const startAt = new Date(body.startAt);
  if (Number.isNaN(+startAt) || startAt.toISOString() !== body.startAt || +startAt % 900000) bad('Choose a valid time on a 15-minute boundary.');
  return { startAt, durationMinutes: duration(body.durationMinutes), ...(editing ? { expectedVersion: version(body.expectedVersion) } : { trainerId: id(body.trainerId), ...(role === 'admin' ? { memberId: id(body.memberId) } : {}) }) };
}
export function transition(body) { fields(body, ['expectedVersion']); return version(body.expectedVersion); }
const integer = (value, fallback, max) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) bad('Invalid pagination.');
  return Number(value);
};
export function options(query) {
  fields(query, ['q', 'page']);
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 100)) bad('Invalid search.');
  return { q: (query.q || '').trim(), page: integer(query.page, 1, 100000) };
}
export function slots(query, role) {
  fields(query, role === 'admin' ? ['trainerId','memberId','date','durationMinutes','excludeId'] : ['trainerId','date','durationMinutes','excludeId']);
  const date = day(query.date);
  if (typeof query.durationMinutes !== 'string' || !/^\d+$/.test(query.durationMinutes)) bad('Invalid duration.');
  return { trainerId: id(query.trainerId), ...(role === 'admin' ? { memberId: id(query.memberId) } : {}), date, durationMinutes: duration(Number(query.durationMinutes)), ...(query.excludeId ? { excludeId: id(query.excludeId) } : {}) };
}
export function list(query, role, now = new Date()) {
  fields(query, role === 'admin' ? ['from','to','status','page','trainerId','memberId'] : ['from','to','status','page']);
  const from = query.from === undefined ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) : day(query.from);
  const to = query.to === undefined ? new Date(+from + 30 * 86400000) : day(query.to);
  if (+to <= +from || +to - +from > 366 * 86400000) bad('Choose an end date after the start, within 366 days.');
  const status = query.status || 'all';
  if (!['all','scheduled','cancelled','completed'].includes(status)) bad('Invalid session status.');
  return { from, to, status, page: integer(query.page, 1, 100000), ...(query.trainerId ? { trainerId: id(query.trainerId) } : {}), ...(query.memberId ? { memberId: id(query.memberId) } : {}) };
}
