import { AppError } from '../utils/AppError.js';
const bad = message => { throw new AppError(400, message); };
export function id(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) bad('Invalid record ID.');
  return value;
}
function object(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key))) bad('Provide only supported fields.');
}
export function planFields(body, create = false) {
  object(body, ['name','durationDays','priceMinor','features','active']);
  if (create && ['name','durationDays','priceMinor','features'].some(key => !(key in body))) bad('Name, duration, price, and features are required.');
  const result = {};
  if ('name' in body) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) bad('Plan name must contain 2–80 characters.');
    result.name = body.name.trim(); result.nameKey = result.name.toLowerCase();
  }
  if ('durationDays' in body) {
    if (!Number.isInteger(body.durationDays) || body.durationDays < 1 || body.durationDays > 3660) bad('Duration must be 1–3660 whole days.');
    result.durationDays = body.durationDays;
  }
  if ('priceMinor' in body) {
    if (!Number.isSafeInteger(body.priceMinor) || body.priceMinor < 0 || body.priceMinor > 100000000) bad('Price must be 0–100000000 paise as a whole number.');
    result.priceMinor = body.priceMinor;
  }
  if ('features' in body) {
    if (!Array.isArray(body.features) || body.features.length > 20 || body.features.some(f => typeof f !== 'string' || !f.trim() || f.trim().length > 160)) bad('Use up to 20 features, each 1–160 characters.');
    result.features = [...new Set(body.features.map(f => f.trim()))];
  }
  if ('active' in body) {
    if (typeof body.active !== 'boolean') bad('Active must be a boolean.');
    result.active = body.active;
  }
  return result;
}
export function day(value) {
  if (typeof value !== 'string' || !/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(value)) bad('Use a date in YYYY-MM-DD format (2000–2099).');
  const result = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0,10) !== value) bad('Invalid calendar date.');
  return result;
}
export function enrollment(body) {
  object(body,['planId','startDate']);
  return { planId: id(body.planId), startAt: day(body.startDate) };
}
export function renewal(body) {
  object(body,['planId','expectedVersion']);
  if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) bad('A current membership version is required. Refresh and try again.');
  return { planId: id(body.planId), expectedVersion: body.expectedVersion };
}
export function listQuery(query, plans = false) {
  if (Object.keys(query).some(key => !['q','status','page','limit'].includes(key)) || Object.values(query).some(v => typeof v !== 'string')) bad('Invalid query parameters.');
  const status = query.status || 'all';
  if (!(plans ? ['all','active','inactive'] : ['all','active','scheduled','expired']).includes(status)) bad('Invalid status filter.');
  const q = (query.q || '').trim();
  if (q.length > 100) bad('Search must not exceed 100 characters.');
  const integer = (v, fallback, max) => {
    if (v === undefined) return fallback;
    if (!/^[1-9][0-9]*$/.test(v) || Number(v) > max) bad('Invalid pagination.');
    return Number(v);
  };
  return { q, status, page: integer(query.page,1,100000), limit: integer(query.limit,10,50) };
}
