import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readEnv, readPushEnv, readRegistrationOptions } from '../src/config/env.js';

test('privileged demo registration requires explicit development opt-in', () => {
  assert.deepEqual(readRegistrationOptions({ NODE_ENV: 'development', DEMO_ROLE_REGISTRATION: 'true' }), {
    demo: true, roles: ['member', 'trainer', 'admin'],
  });
  for (const NODE_ENV of ['production', 'test', undefined, 'Development']) {
    assert.deepEqual(readRegistrationOptions({ NODE_ENV, DEMO_ROLE_REGISTRATION: 'true' }), { demo: false, roles: ['member'] });
  }
  for (const DEMO_ROLE_REGISTRATION of [undefined, 'false', 'TRUE', '1']) {
    assert.equal(readRegistrationOptions({ NODE_ENV: 'development', DEMO_ROLE_REGISTRATION }).demo, false);
  }
});

test('configuration accepts local and Atlas MongoDB URIs', () => {
  for (const uri of ['mongodb://127.0.0.1:27017/fittrack', 'mongodb+srv://user:password@example.test/fittrack']) {
    assert.equal(readEnv({ MONGODB_URI: uri }).mongoUri, uri);
  }
});

test('missing or invalid connection configuration fails without exposing its value', () => {
  for (const value of [undefined, '', 'https://secret@example.test', 'mongodb://']) {
    assert.throws(() => readEnv({ MONGODB_URI: value }), {
      message: 'MONGODB_URI must be a valid mongodb:// or mongodb+srv:// connection string.',
    });
  }
});

test('invalid API ports are rejected', () => {
  for (const port of ['0', '-1', '65536', 'abc', '1.5']) {
    assert.throws(() => readEnv({ PORT: port, MONGODB_URI: 'mongodb://127.0.0.1/fittrack' }), /PORT must/);
  }
});

test('phone push configuration is optional but must be complete when enabled', () => {
  assert.deepEqual(readPushEnv({}), { publicKey: '', privateKey: '', subject: '' });
  const configured = { VAPID_PUBLIC_KEY: 'public', VAPID_PRIVATE_KEY: 'private', VAPID_SUBJECT: 'mailto:admin@example.test' };
  assert.deepEqual(readPushEnv(configured), { publicKey: 'public', privateKey: 'private', subject: 'mailto:admin@example.test' });
  assert.throws(() => readPushEnv({ VAPID_PUBLIC_KEY: 'public' }), /Configure VAPID_PUBLIC_KEY/);
  assert.throws(() => readPushEnv({ ...configured, VAPID_SUBJECT: 'invalid' }), /VAPID_SUBJECT/);
});
