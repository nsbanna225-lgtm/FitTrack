import { id } from './membershipValidators.js';
import { AppError } from '../utils/AppError.js';
const bad = message => { throw new AppError(400, message); };
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) bad('Provide only supported payment fields.');
}
export function create(body, role) {
  object(body, role === 'admin' ? ['memberId', 'periodId'] : ['periodId']);
  return { periodId: id(body.periodId), ...(role === 'admin' ? { memberId: id(body.memberId) } : {}) };
}
export function transition(body, retry = false) {
  object(body, retry ? ['expectedVersion'] : ['expectedVersion', 'outcome']);
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) bad('Refresh to obtain the current payment version.');
  if (!retry && !['paid', 'failed'].includes(body.outcome)) bad('Select a simulated paid or failed outcome.');
  return { expectedVersion: body.expectedVersion, outcome: retry ? 'pending' : body.outcome };
}
export function list(query, role) {
  object(query, ['page', 'status', ...(role === 'admin' ? ['memberId', 'q'] : [])]);
  if (Object.values(query).some(value => typeof value !== 'string')) bad('Invalid query parameters.');
  if (query.page !== undefined && !/^[1-9][0-9]{0,5}$/.test(query.page)) bad('Invalid page.');
  const status = query.status || 'all', q = (query.q || '').trim();
  if (!['all', 'pending', 'paid', 'failed'].includes(status) || q.length > 100) bad('Invalid status or search.');
  return { page: Number(query.page || 1), status, q, ...(query.memberId !== undefined ? { memberId: id(query.memberId) } : {}) };
}
