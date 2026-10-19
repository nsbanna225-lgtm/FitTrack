import { AppError } from '../utils/AppError.js';
import { validateProfile, validateEmail } from './authValidators.js';
const invalid = message => { throw new AppError(400, message); };
export function memberId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) invalid('Invalid member ID.');
  return value;
}
function object(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key))) invalid('Provide only supported fields.');
}
export function listQuery(query) {
  if (Object.keys(query).some(key => !['q','status','sort','page','limit'].includes(key))) invalid('Unsupported query parameter.');
  for (const value of Object.values(query)) if (typeof value !== 'string') invalid('Query parameters must be single strings.');
  const q = (query.q || '').trim();
  if (q.length > 100) invalid('Search must not exceed 100 characters.');
  const status = query.status || 'all';
  if (!['all','active','inactive','archived'].includes(status)) invalid('Invalid account status.');
  const sort = query.sort || 'newest';
  if (!['newest','oldest','name'].includes(sort)) invalid('Invalid sort order.');
  const integer = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (!/^[1-9][0-9]*$/.test(value) || Number(value) > max) invalid('Invalid pagination value.');
    return Number(value);
  };
  return { q, status, sort, page: integer(query.page, 1, 100000), limit: integer(query.limit, 10, 50) };
}
export function accountUpdate(body) {
  object(body, ['name','email','phone','active']);
  const result = {};
  const profile = Object.fromEntries(Object.entries(body).filter(([key]) => ['name','phone'].includes(key)));
  if (Object.keys(profile).length) Object.assign(result, validateProfile(profile));
  if ('email' in body) result.email = validateEmail(body.email);
  if ('active' in body) {
    if (typeof body.active !== 'boolean') invalid('Active must be a boolean.');
    result.active = body.active;
  }
  return result;
}
export function memberProfile(body) {
  object(body, ['assignedTrainer','goals','notes']);
  const result = {};
  for (const [key,max] of [['goals',1000],['notes',2000]]) if (key in body) {
    if (typeof body[key] !== 'string' || body[key].length > max) invalid(`${key} must be text up to ${max} characters.`);
    result[key] = body[key].trim();
  }
  if ('assignedTrainer' in body) result.assignedTrainer = body.assignedTrainer === null ? null : memberId(body.assignedTrainer);
  return result;
}
