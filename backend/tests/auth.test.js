import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readAuthEnv } from '../src/config/env.js';
import { validateRegistration, validateLogin, validateProfile, validatePassword, validateReset } from '../src/validators/authValidators.js';
import { authorize } from '../src/middleware/auth.js';

test('JWT configuration requires a long non-placeholder secret', () => {
  for (const secret of [undefined, '', 'short', 'replace-me'.repeat(10)]) {
    assert.throws(() => readAuthEnv({ JWT_SECRET: secret }), /JWT_SECRET must/);
  }
  assert.ok(readAuthEnv({ JWT_SECRET: randomBytes(48).toString('hex') }).jwtSecret);
});
test('registration rejects role injection and normalizes email', () => {
  const valid = { name: ' Test User ', email: ' PERSON@EXAMPLE.COM ', password: 'long-safe-password' };
  assert.equal(validateRegistration(valid).email, 'person@example.com');
  assert.equal(validateRegistration(valid).role, 'member');
  assert.throws(() => validateRegistration({ ...valid, role: 'admin' }), /limited to Member/);
  assert.equal(validateRegistration({ ...valid, role: 'member' }).role, 'member');
});
test('demo registration accepts only supported explicit roles without relaxing other validation', () => {
  const valid = { name: 'Demo User', email: ' DEMO@example.test ', password: 'long-safe-password' };
  for (const role of ['member', 'trainer', 'admin']) assert.equal(validateRegistration({ ...valid, role }, false, true).role, role);
  for (const role of [undefined, null, '', 'owner', 'Admin', ['admin'], { $ne: null }]) {
    assert.throws(() => validateRegistration({ ...valid, role }, false, true), /Select a valid role/);
  }
  assert.throws(() => validateRegistration({ ...valid, role: 'admin', password: 'short' }, false, true), /12 characters/);
  assert.throws(() => validateRegistration({ ...valid, role: 'admin', email: 'invalid' }, false, true), /valid email/);
  assert.throws(() => validateRegistration({ ...valid, role: 'admin', active: true }, false, true), /unsupported/);
});
test('validators reject operator injection, arrays, and protected profile fields', () => {
  assert.throws(() => validateLogin({ email: { $ne: null }, password: 'password' }), /email/);
  assert.throws(() => validateRegistration([]), /JSON object/);
  assert.throws(() => validateProfile({ role: 'admin' }), /unsupported/);
  assert.throws(() => validateProfile({ passwordHash: 'x' }), /unsupported/);
  assert.throws(() => validateProfile({}), /Provide/);
});
test('password byte limit prevents bcrypt truncation including multibyte input', () => {
  assert.throws(() => validatePassword('a'.repeat(73)), /72 UTF-8/);
  assert.throws(() => validatePassword('🔒'.repeat(19)), /72 UTF-8/);
  assert.throws(() => validatePassword('short'), /12 characters/);
  assert.throws(() => validateReset({ token: 'invalid', password: 'safe-password-123' }), /invalid or expired/);
});
test('login requires an explicit supported role and preserves normalized credentials', () => {
  const credentials = { email: ' PERSON@EXAMPLE.COM ', password: 'test-password' };
  for (const role of ['member', 'trainer', 'admin']) {
    assert.deepEqual(validateLogin({ ...credentials, role }), { email: 'person@example.com', password: credentials.password, role });
  }
  for (const role of [undefined, null, '', 'owner', 'Admin', ['admin'], { $ne: null }]) {
    assert.throws(() => validateLogin({ ...credentials, role }), { status: 400, message: 'Select a valid role.' });
  }
});
test('authorization distinguishes absent authentication from forbidden roles', () => {
  const adminOnly = authorize('admin');
  assert.throws(() => adminOnly({}, {}, () => {}), { status: 401 });
  assert.throws(() => adminOnly({ user: { role: 'member' } }, {}, () => {}), { status: 403 });
  let nextCalled = false;
  adminOnly({ user: { role: 'admin' } }, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
