import { AppError } from '../utils/AppError.js';
import { id } from './membershipValidators.js';
const bad = message => { throw new AppError(400, message); };
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) bad('Provide only supported progress fields.');
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value || value < '1900-01-01') bad('Use a valid YYYY-MM-DD date from 1900 onward.');
  return value;
}
function measurement(value, name, min, max, optional = true) {
  if (optional && (value === undefined || value === null)) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || Math.abs(value * 10 - Math.round(value * 10)) > 1e-7) bad(`${name} must be ${min}–${max}, with at most one decimal place.`);
  return value;
}
export function entry(body, edit = false, now = new Date()) {
  object(body, ['day', 'weightKg', 'heightCm', 'waistCm', 'chestCm', 'hipsCm', 'notes', ...(edit ? ['expectedVersion'] : [])]);
  const day = date(body.day);
  if (day > now.toISOString().slice(0, 10)) bad('Measurement dates cannot be in the future (UTC).');
  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 2000)) bad('Notes must contain at most 2000 characters.');
  if (edit && (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1)) bad('Refresh to obtain the current entry version.');
  return { day, weightKg: measurement(body.weightKg, 'Weight (kg)', 1, 500, false), heightCm: measurement(body.heightCm, 'Height (cm)', 30, 250),
    ...Object.fromEntries(['waistCm', 'chestCm', 'hipsCm'].map(key => [key, measurement(body[key], key, 1, 300)])), notes: (body.notes || '').trim(), ...(edit ? { expectedVersion: body.expectedVersion } : {}) };
}
export function list(query, now = new Date()) {
  object(query, ['from', 'to', 'page']);
  if (Object.values(query).some(value => typeof value !== 'string')) bad('Invalid query parameters.');
  const to = date(query.to ?? now.toISOString().slice(0, 10));
  const defaultFrom = new Date(Date.parse(to) - 89 * 86400000).toISOString().slice(0, 10);
  const from = date(query.from ?? (defaultFrom < '1900-01-01' ? '1900-01-01' : defaultFrom));
  if (to > now.toISOString().slice(0, 10) || from > to || Date.parse(to) - Date.parse(from) >= 366 * 86400000) bad('Select up to 366 days, ending no later than today (UTC).');
  if (query.page !== undefined && !/^[1-9][0-9]{0,5}$/.test(query.page)) bad('Invalid page.');
  return { from, to, page: Number(query.page || 1) };
}
export { id };
