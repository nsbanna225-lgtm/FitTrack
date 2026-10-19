import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { createUser, requestPasswordReset } from '../src/services/authService.js';
import { issueToken, tokenOptions } from '../src/services/tokenService.js';
import { authLimiter, loginLimiter } from '../src/middleware/authRateLimit.js';

// Always use a newly named local test database; never use the application database.
const databaseName = `fittrack_test_${randomUUID().replaceAll('-', '')}`;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.NODE_ENV = 'development';
process.env.DEMO_ROLE_REGISTRATION = 'false';
const password = 'Test-password-only-123!';
const nextPassword = 'New-test-password-456!';
let base;

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${base}/api/auth${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
function assertPublic(user) {
  assert.deepEqual(Object.keys(user).sort(), ['id', 'name', 'email', 'phone', 'role', 'createdAt', 'updatedAt'].sort());
}

test('authentication integration with isolated MongoDB', { timeout: 120000 }, async (t) => {
  let server;
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${databaseName}`, { serverSelectionTimeoutMS: 5000, autoIndex: false });
    await User.createIndexes();
    server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    base = `http://127.0.0.1:${server.address().port}`;
    let member;
    let token;
    let admin;
    let adminToken;
    await t.test('registers a member, hashes the password, and excludes private fields', async () => {
      const result = await request('/register', { method: 'POST', body: { name: 'Test Member', email: ' Member@Example.Test ', password } });
      assert.equal(result.status, 201);
      assert.equal(result.data.user.role, 'member');
      assert.equal(result.data.user.email, 'member@example.test');
      assertPublic(result.data.user);
      assert.equal(result.headers.get('cache-control'), 'no-store');
      assert.equal(result.data.accessToken, undefined);
      assert.equal(result.data.message, 'Account created successfully. Please sign in.');
      token = (await request('/login', { method: 'POST', body: { email: 'member@example.test', password, role: 'member' } })).data.accessToken;
      member = await User.findById(result.data.user.id).select('+passwordHash +tokenVersion');
      assert.notEqual(member.passwordHash, password);
      assert.equal(bcrypt.getRounds(member.passwordHash), 12);
      assert.ok(await bcrypt.compare(password, member.passwordHash));
      assert.equal((await request('/me', { token })).status, 200);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      assert.equal(decoded.exp - decoded.iat, 900);
    });
    await t.test('rejects role injection, NoSQL injection, short passwords, and concurrent duplicate emails', async () => {
      const body = { name: 'Bad Request', email: 'bad@example.test', password };
      assert.equal((await request('/register', { method: 'POST', body: { ...body, role: 'admin' } })).status, 400);
      assert.equal((await request('/login', { method: 'POST', body: { email: { $ne: null }, password } })).status, 400);
      assert.equal((await request('/register', { method: 'POST', body: { ...body, password: 'short' } })).status, 400);
      const responses = await Promise.all([1, 2].map(() => request('/register', { method: 'POST', body: { ...body, email: 'race@example.test' } })));
      assert.deepEqual(responses.map((result) => result.status).sort(), [201, 409]);
    });
    await t.test('login failures are generic; valid credentials succeed', async () => {
      const wrong = await request('/login', { method: 'POST', body: { role: 'member', email: member.email, password: 'wrong-password' } });
      const missing = await request('/login', { method: 'POST', body: { role: 'member', email: 'missing@example.test', password } });
      assert.equal(wrong.status, 401);
      assert.deepEqual(wrong.data, missing.data);
      const result = await request('/login', { method: 'POST', body: { role: 'member', email: member.email, password } });
      assert.equal(result.status, 200);
      assertPublic(result.data.user);
    });
    await t.test('missing, tampered, expired, and wrong-audience tokens are rejected', async () => {
      assert.equal((await request('/me')).status, 401);
      assert.equal((await request('/me', { token: `${token}broken` })).status, 401);
      for (const options of [{ expiresIn: -1 }, { audience: 'other-app' }]) {
        const bad = jwt.sign({ ver: member.tokenVersion }, process.env.JWT_SECRET, { ...tokenOptions, subject: String(member._id), ...options });
        assert.equal((await request('/me', { token: bad })).status, 401);
      }
    });
    await t.test('only admins can provision staff and database roles take immediate effect', async () => {
      const staff = { name: 'Test Trainer', email: 'trainer@example.test', password, role: 'trainer' };
      assert.equal((await request('/staff', { method: 'POST', body: staff })).status, 401);
      assert.equal((await request('/staff', { method: 'POST', body: staff, token })).status, 403);
      admin = await createUser({ name: 'Test Admin', email: 'admin@example.test', password, role: 'admin' });
      adminToken = issueToken(admin);
      const created = await request('/staff', { method: 'POST', body: staff, token: adminToken });
      assert.equal(created.status, 201);
      assertPublic(created.data.user);
      const trainerLogin = await request('/login', { method: 'POST', body: { role: 'trainer', email: staff.email, password } });
      assert.equal((await request('/staff', { method: 'POST', body: staff, token: trainerLogin.data.accessToken })).status, 403);
      await User.updateOne({ _id: admin._id }, { $set: { role: 'member' } });
      assert.equal((await request('/staff', { method: 'POST', body: staff, token: adminToken })).status, 403);
      await User.updateOne({ _id: admin._id }, { $set: { role: 'admin' } });
    });
    await t.test('profile updates allow name and phone only', async () => {
      assert.equal((await request('/me', { method: 'PATCH', body: { role: 'admin' }, token })).status, 400);
      const result = await request('/me', { method: 'PATCH', body: { name: 'Updated Member', phone: '+91 1234567890' }, token });
      assert.equal(result.status, 200);
      assert.equal(result.data.user.name, 'Updated Member');
      assertPublic(result.data.user);
    });
    await t.test('selected roles must match; login never changes database roles or grants selected permissions', async () => {
      for (const [email, role] of [[member.email, 'member'], ['trainer@example.test', 'trainer'], [admin.email, 'admin']]) {
        const result = await request('/login', { method: 'POST', body: { email, password, role } });
        assert.equal(result.status, 200);
        assert.equal(result.data.user.role, role);
        const me = await request('/me', { token: result.data.accessToken });
        assert.equal(me.data.user.role, role);
        const decoded = jwt.verify(result.data.accessToken, process.env.JWT_SECRET, tokenOptions);
        assert.equal(decoded.sub, result.data.user.id);
      }
      for (const [email, selected, actual] of [[member.email, 'admin', 'member'], ['trainer@example.test', 'member', 'trainer']]) {
        const before = await User.findOne({ email }).select('+passwordHash +tokenVersion').lean();
        const result = await request('/login', { method: 'POST', body: { email, password, role: selected } });
        assert.equal(result.status, 403);
        assert.equal(result.data.message, 'Selected role does not match this account.');
        assert.equal(result.data.accessToken, undefined);
        const after = await User.findOne({ email }).select('+passwordHash +tokenVersion').lean();
        assert.equal(after.role, actual);
        assert.deepEqual(after, before);
      }
      const badPassword = await request('/login', { method: 'POST', body: { email: member.email, password: 'incorrect', role: 'admin' } });
      assert.equal(badPassword.status, 401);
      assert.equal(badPassword.data.message, 'Invalid email or password.');
    });
    await t.test('disabled accounts cannot use existing tokens or log in', async () => {
      await User.updateOne({ _id: member._id }, { $set: { active: false } });
      assert.equal((await request('/me', { token })).status, 401);
      assert.equal((await request('/login', { method: 'POST', body: { role: 'member', email: member.email, password } })).status, 401);
      await User.updateOne({ _id: member._id }, { $set: { active: true } });
    });
    await t.test('password changes verify the old password and revoke all existing tokens', async () => {
      assert.equal((await request('/change-password', { method: 'POST', token, body: { currentPassword: 'incorrect', newPassword: nextPassword } })).status, 401);
      assert.equal((await request('/change-password', { method: 'POST', token, body: { currentPassword: password, newPassword: nextPassword } })).status, 200);
      assert.equal((await request('/me', { token })).status, 401);
      assert.equal((await request('/login', { method: 'POST', body: { role: 'member', email: member.email, password } })).status, 401);
      const result = await request('/login', { method: 'POST', body: { role: 'member', email: member.email, password: nextPassword } });
      assert.equal(result.status, 200);
      token = result.data.accessToken;
    });
    await t.test('logout revokes every previously issued token', async () => {
      const second = await request('/login', { method: 'POST', body: { role: 'member', email: member.email, password: nextPassword } });
      assert.equal((await request('/logout', { method: 'POST', token })).status, 200);
      assert.equal((await request('/me', { token })).status, 401);
      assert.equal((await request('/me', { token: second.data.accessToken })).status, 401);
    });
    await t.test('reset delivery is explicitly unavailable and does not disclose account existence', async () => {
      const exists = await request('/forgot-password', { method: 'POST', body: { email: member.email } });
      const missing = await request('/forgot-password', { method: 'POST', body: { email: 'missing@example.test' } });
      assert.equal(exists.status, 503);
      assert.deepEqual(exists.data, missing.data);
    });
    await t.test('reset tokens are hashed, expire, are single-use, and revoke sessions', async () => {
      let resetToken;
      await requestPasswordReset(member.email, async ({ token: value }) => { resetToken = value; });
      const stored = await User.findById(member._id).select('+resetTokenHash +resetTokenExpiresAt');
      assert.notEqual(stored.resetTokenHash, resetToken);
      assert.equal(stored.resetTokenHash, createHash('sha256').update(resetToken).digest('hex'));
      assert.ok(stored.resetTokenExpiresAt > new Date());
      const session = await request('/login', { method: 'POST', body: { role: 'member', email: member.email, password: nextPassword } });
      const responses = await Promise.all([1, 2].map(() => request('/reset-password', { method: 'POST', body: { token: resetToken, password } })));
      assert.deepEqual(responses.map((result) => result.status).sort(), [200, 400]);
      assert.equal((await request('/me', { token: session.data.accessToken })).status, 401);
      const login = await request('/login', { method: 'POST', body: { role: 'member', email: member.email, password } });
      assert.equal(login.status, 200);
      await requestPasswordReset(member.email, async ({ token: value }) => { resetToken = value; });
      await User.updateOne({ _id: member._id }, { $set: { resetTokenExpiresAt: new Date(0) } });
      assert.equal((await request('/reset-password', { method: 'POST', body: { token: resetToken, password: nextPassword } })).status, 400);
    });
    await t.test('failed delivery removes the reset token and unknown accounts do not invoke delivery', async () => {
      await assert.rejects(requestPasswordReset(member.email, async () => { throw new Error('delivery failed'); }), { status: 503 });
      const user = await User.findById(member._id).select('+resetTokenHash');
      assert.equal(user.resetTokenHash, undefined);
      let called = false;
      await requestPasswordReset('missing@example.test', async () => { called = true; });
      assert.equal(called, false);
    });
    await t.test('deleted accounts cannot use previously issued tokens', async () => {
      await User.deleteOne({ _id: admin._id });
      assert.equal((await request('/me', { token: adminToken })).status, 401);
    });
    await t.test('demo signup for all roles preserves password, JWT, login matching and route authorization', async () => {
      // Independent scenario: previous cases deliberately consumed this client's failure budget.
      authLimiter.resetKey('127.0.0.1');
      loginLimiter.resetKey('127.0.0.1');
      process.env.DEMO_ROLE_REGISTRATION = 'true';
      try {
        assert.deepEqual((await request('/registration-options')).data, { demo: true, roles: ['member', 'trainer', 'admin'] });
        for (const role of ['member', 'trainer', 'admin']) {
          const email = `demo-${role}@example.test`;
          const body = { name: `Demo ${role}`, email, password, role };
          const created = await request('/register', { method: 'POST', body });
          assert.equal(created.status, 201);
          assert.equal(created.data.user.role, role);
          assert.equal(created.data.accessToken, undefined);
          const saved = await User.findById(created.data.user.id).select('+passwordHash').lean();
          assert.equal(saved.role, role);
          assert.equal(saved.password, undefined);
          assert.equal(bcrypt.getRounds(saved.passwordHash), 12);
          assert.ok(await bcrypt.compare(password, saved.passwordHash));
          const loggedIn = await request('/login', { method: 'POST', body: { email, password, role } });
          assert.equal(loggedIn.status, 200);
          assert.equal(loggedIn.data.user.role, role);
          assert.equal(jwt.verify(loggedIn.data.accessToken, process.env.JWT_SECRET, tokenOptions).sub, created.data.user.id);
          assert.equal((await request('/me', { token: loggedIn.data.accessToken })).data.user.role, role);
          const protectedResponse = await fetch(`${base}/api/trainers`, { headers: { Authorization: `Bearer ${loggedIn.data.accessToken}` } });
          assert.equal(protectedResponse.status, role === 'admin' ? 200 : 403);
          assert.equal((await request('/register', { method: 'POST', body: { ...body, email: email.toUpperCase() } })).status, 409);
          if (role !== 'admin') {
            const mismatch = await request('/login', { method: 'POST', body: { email, password, role: role === 'trainer' ? 'admin' : 'trainer' } });
            assert.equal(mismatch.status, 403);
            assert.equal(mismatch.data.message, 'Selected role does not match this account.');
            assert.equal(mismatch.data.accessToken, undefined);
            assert.deepEqual(await User.findById(saved._id).select('+passwordHash').lean(), saved);
          }
        }
        assert.equal((await request('/register', { method: 'POST', body: { name: 'Bad Role', email: 'bad-role@example.test', password, role: 'owner' } })).status, 400);
        process.env.NODE_ENV = 'production';
        assert.deepEqual((await request('/registration-options')).data, { demo: false, roles: ['member'] });
        for (const role of ['admin', 'trainer']) assert.equal((await request('/register', { method: 'POST', body: { name: 'Blocked Role', email: 'blocked@example.test', password, role } })).status, 400);
      } finally {
        process.env.NODE_ENV = 'development';
        process.env.DEMO_ROLE_REGISTRATION = 'false';
      }
    });
    await t.test('repeated unsuccessful logins are rate limited', async () => {
      authLimiter.resetKey('127.0.0.1');
      loginLimiter.resetKey('127.0.0.1');
      let last;
      for (let i = 0; i < 12; i++) {
        last = await request('/login', { method: 'POST', body: { role: 'member', email: 'missing@example.test', password } });
        if (last.status === 429) break;
      }
      assert.equal(last.status, 429);
      assert.ok(last.headers.get('retry-after'));
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    // Drop only this run's explicitly named, randomly generated test database.
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === databaseName && /^fittrack_test_[a-f0-9]{32}$/.test(databaseName)) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  }
});
