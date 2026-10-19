import { AppError } from '../utils/AppError.js';
export { id } from './membershipValidators.js';
import { id } from './membershipValidators.js';
const bad = message => { throw new AppError(400, message); };
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) bad('Provide only supported workout fields.');
}
function text(value, label, max, required = false) {
  if (typeof value !== 'string' || value.trim().length > max || (required && value.trim().length < 2)) bad(`${label} must contain ${required ? '2' : '0'}–${max} characters.`);
  return value.trim();
}
function integer(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) bad(`${label} must be a whole number between ${min} and ${max}.`);
  return value;
}
export const version = value => integer(value, 'Current version', 1, Number.MAX_SAFE_INTEGER - 1);
export function exercise(body, edit = false) {
  object(body, ['name', 'instructions', ...(edit ? ['active', 'expectedVersion'] : [])]);
  const result = { name: text(body.name, 'Exercise name', 80, true), instructions: text(body.instructions ?? '', 'Instructions', 1000) };
  if (edit) {
    if (typeof body.active !== 'boolean') bad('Active must be true or false.');
    result.active = body.active; result.expectedVersion = version(body.expectedVersion);
  }
  return result;
}
export function plan(body, edit = false) {
  object(body, ['name', 'instructions', 'items', ...(edit ? ['active', 'expectedVersion'] : [])]);
  const result = { name: text(body.name, 'Plan name', 80, true), instructions: text(body.instructions ?? '', 'Plan instructions', 2000) };
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) bad('A plan needs 1–50 exercise entries.');
  result.items = body.items.map(row => {
    object(row, ['exerciseId','day','sets','reps','durationSeconds','restSeconds','instructions']);
    const reps = row.reps == null ? null : integer(row.reps, 'Reps', 1, 1000);
    const durationSeconds = row.durationSeconds == null ? null : integer(row.durationSeconds, 'Duration in seconds', 1, 7200);
    if (!reps && !durationSeconds) bad('Each exercise needs reps or duration.');
    return { exerciseId: id(row.exerciseId), day: integer(row.day, 'Workout day', 1, 7), sets: integer(row.sets, 'Sets', 1, 50), reps, durationSeconds,
      restSeconds: integer(row.restSeconds, 'Rest in seconds', 0, 3600), instructions: text(row.instructions ?? '', 'Exercise instructions', 1000) };
  });
  if (edit) {
    if (typeof body.active !== 'boolean') bad('Active must be true or false.');
    result.active = body.active; result.expectedVersion = version(body.expectedVersion);
  }
  return result;
}
export function assignment(body) {
  object(body, ['memberId','expectedVersion']);
  return { memberId: id(body.memberId), expectedVersion: version(body.expectedVersion) };
}
export function completion(body) {
  object(body, ['itemIndex','completed','expectedVersion']);
  if (typeof body.completed !== 'boolean') bad('Completed must be true or false.');
  return { itemIndex: integer(body.itemIndex, 'Exercise index', 0, 49), completed: body.completed, expectedVersion: version(body.expectedVersion) };
}
export function transition(body) { object(body, ['expectedVersion']); return { expectedVersion: version(body.expectedVersion) }; }
export function list(query, kind, role) {
  const keys = ['q','page','status', ...(kind === 'assignments' && role !== 'member' ? ['memberId'] : []), ...(kind === 'exercises' && role === 'admin' ? ['ownerId'] : [])];
  object(query, keys);
  if (Object.values(query).some(v => typeof v !== 'string')) bad('Invalid query parameters.');
  const q = text(query.q ?? '', 'Search', 100);
  const statuses = kind === 'assignments' ? ['all','active','completed','archived'] : kind === 'members' ? ['all'] : ['all','active','inactive'];
  const status = query.status || (kind === 'members' ? 'all' : 'active');
  if (!statuses.includes(status)) bad('Invalid status filter.');
  if (query.page !== undefined && !/^[1-9][0-9]{0,5}$/.test(query.page)) bad('Invalid page.');
  return { q, status, page: Number(query.page || 1), ...(query.memberId ? { memberId: id(query.memberId) } : {}), ...(query.ownerId ? { ownerId: id(query.ownerId) } : {}) };
}
