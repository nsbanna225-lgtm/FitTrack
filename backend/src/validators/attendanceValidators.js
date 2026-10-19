import { AppError } from '../utils/AppError.js';
import { id } from './membershipValidators.js';
const bad = message => { throw new AppError(400, message); };
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) bad('Provide only supported attendance fields.');
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) bad('Dates must be valid YYYY-MM-DD dates.');
  return value;
}
export function checkIn(body, role) {
  object(body, role === 'admin' ? ['memberId'] : []);
  return role === 'admin' ? { memberId: id(body.memberId) } : {};
}
export function list(query, role, now = new Date()) {
  object(query, ['from', 'to', 'page', ...(role === 'admin' ? ['memberId', 'q'] : [])]);
  if (Object.values(query).some(value => typeof value !== 'string')) bad('Invalid query parameters.');
  const today = now.toISOString().slice(0, 10);
  const from = date(query.from ?? `${today.slice(0, 7)}-01`), to = date(query.to ?? today);
  if (from > to || to > today || (Date.parse(to) - Date.parse(from)) / 86400000 >= 366) bad('Select up to 366 days, ending no later than today (UTC).');
  if (query.page !== undefined && !/^[1-9][0-9]{0,5}$/.test(query.page)) bad('Invalid page.');
  const q = (query.q ?? '').trim();
  if (q.length > 100) bad('Search must contain at most 100 characters.');
  return { from, to, page: Number(query.page || 1), q, ...(query.memberId !== undefined ? { memberId: id(query.memberId) } : {}) };
}
