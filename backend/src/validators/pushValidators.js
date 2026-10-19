import { AppError } from '../utils/AppError.js';

const bad = () => { throw new AppError(400, 'Provide a valid push subscription.'); };

export function empty(query) {
  if (Object.keys(query).length) bad();
}

export function subscription(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['endpoint', 'expirationTime', 'keys'].includes(key))) bad();
  if (typeof body.endpoint !== 'string' || body.endpoint.length > 2048 || typeof body.keys !== 'object' || !body.keys || Array.isArray(body.keys)) bad();
  if (Object.keys(body.keys).length !== 2 || typeof body.keys.p256dh !== 'string' || !body.keys.p256dh || typeof body.keys.auth !== 'string' || !body.keys.auth || body.keys.p256dh.length > 256 || body.keys.auth.length > 128) bad();
  if (body.expirationTime !== undefined && body.expirationTime !== null && (typeof body.expirationTime !== 'number' || !Number.isFinite(body.expirationTime))) bad();
  try { if (new URL(body.endpoint).protocol !== 'https:') bad(); } catch { bad(); }
  return { endpoint: body.endpoint, keys: { p256dh: body.keys.p256dh, auth: body.keys.auth } };
}

export function endpoint(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.endpoint !== 'string' || body.endpoint.length > 2048) bad();
  try { if (new URL(body.endpoint).protocol !== 'https:') bad(); } catch { bad(); }
  return body.endpoint;
}