import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export function readEnv(source = process.env) {
  const port = Number(source.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const mongoUri = source.MONGODB_URI?.trim();
  if (!mongoUri || !/^mongodb(?:\+srv)?:\/\/\S+$/.test(mongoUri)) {
    throw new Error('MONGODB_URI must be a valid mongodb:// or mongodb+srv:// connection string.');
  }
  return { port, host: source.HOST || '127.0.0.1', mongoUri };
}

export function readAuthEnv(source = process.env) {
  const jwtSecret = source.JWT_SECRET;
  if (typeof jwtSecret !== 'string' || jwtSecret.length < 64 || /replace|change.?me|your.?secret/i.test(jwtSecret)) {
    throw new Error('JWT_SECRET must be configured with at least 64 random characters.');
  }
  return { jwtSecret };
}

export function readPushEnv(source = process.env) {
  const publicKey = source.VAPID_PUBLIC_KEY?.trim() || '';
  const privateKey = source.VAPID_PRIVATE_KEY?.trim() || '';
  const subject = source.VAPID_SUBJECT?.trim() || '';
  if (![publicKey, privateKey, subject].every(Boolean)) {
    if (publicKey || privateKey || subject) throw new Error('Configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT together.');
    return { publicKey: '', privateKey: '', subject: '' };
  }
  if (!/^(mailto:.+|https:\/\/.+)$/.test(subject)) throw new Error('VAPID_SUBJECT must be a mailto: address or HTTPS URL.');
  return { publicKey, privateKey, subject };
}

// Explicit opt-in for college demos. Unset flags and non-development environments stay Member-only.
export function readRegistrationOptions(source = process.env) {
  const demo = source.NODE_ENV === 'development' && source.DEMO_ROLE_REGISTRATION === 'true';
  return { demo, roles: demo ? ['member', 'trainer', 'admin'] : ['member'] };
}
