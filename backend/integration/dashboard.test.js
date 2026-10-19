import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { issueToken } from '../src/services/tokenService.js';
import { getAdminDashboard } from '../src/services/dashboardService.js';

process.env.JWT_SECRET = randomBytes(48).toString('hex');
const db = `fittrack_test_dashboard_${randomUUID().replaceAll('-', '')}`;
test('admin dashboard with isolated MongoDB', { timeout: 30000 }, async t => {
  let server;
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${db}`, { serverSelectionTimeoutMS: 5000 });
    const now = new Date('2026-01-15T12:00:00Z');
    await t.test('empty data produces zero counts and six zero-filled months', async () => {
      const data = await getAdminDashboard(now);
      assert.equal(data.summary.totalMembers, 0);
      assert.deepEqual(data.registrations.map(item => item.month), ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01']);
      assert.ok(data.registrations.every(item => item.count === 0));
      assert.deepEqual(data.recentMembers, []);
      assert.deepEqual(data.modules.memberships, { available: true, active: 0, scheduled: 0, expired: 0 });
      assert.deepEqual(data.modules.payments, { available: true, mode: 'simulation', currency: 'INR', totalMinor: 0, monthMinor: 0, paidCount: 0, recent: [] });
      assert.deepEqual(data.modules.attendance, { available: true, today: 0, month: 0 });
      assert.deepEqual(data.modules.sessions, { available: true, upcoming: [] });
    });
    const make = (role, active = true) => ({ name: `Test ${role}`, email: `${randomUUID()}@example.test`, passwordHash: 'test-fixture-never-used-for-login', role, active, tokenVersion: 0 });
    const admin = await User.create(make('admin'));
    const trainer = await User.create(make('trainer'));
    const member = await User.create(make('member'));
    await User.collection.updateOne({ _id: member._id }, { $set: { createdAt: new Date('2025-08-01T00:00:00Z') } });
    await User.collection.insertMany([
      { ...make('member', false), createdAt: new Date('2025-07-31T23:59:59.999Z') },
      { ...make('member'), createdAt: new Date('2026-01-01T00:00:00Z') },
      { ...make('member'), createdAt: new Date('2026-01-15T12:00:00Z') },
      { ...make('member'), createdAt: new Date('2026-01-15T12:00:01Z') },
      { ...make('member'), createdAt: new Date('2025-12-31T23:59:59.999Z') },
      { ...make('member'), createdAt: new Date('2025-10-05T00:00:00Z') },
    ]);
    await t.test('counts roles and active accounts; handles UTC boundaries and excludes future growth', async () => {
      const data = await getAdminDashboard(now);
      assert.deepEqual(data.summary, { totalMembers: 7, activeMemberAccounts: 6, inactiveMemberAccounts: 1, totalTrainers: 1, activeTrainers: 1, newMembersThisMonth: 2 });
      assert.deepEqual(data.registrations.map(item => item.count), [1,0,1,0,1,2]);
      assert.equal(data.recentMembers.length, 5);
      for (const item of data.recentMembers) assert.deepEqual(Object.keys(item).sort(), ['active','createdAt','email','id','name']);
      assert.ok(data.recentMembers.every((item, i, list) => !i || item.createdAt <= list[i-1].createdAt));
    });
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const request = token => fetch(`http://127.0.0.1:${server.address().port}/api/dashboard/admin`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    await t.test('HTTP endpoint permits admins only and disables caching', async () => {
      assert.equal((await request()).status, 401);
      assert.equal((await request(issueToken(member))).status, 403);
      assert.equal((await request(issueToken(trainer))).status, 403);
      const response = await request(issueToken(admin));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal((await response.json()).summary.totalMembers, 7);
    });
    await t.test('current roles and disabled accounts are enforced on existing tokens', async () => {
      const token = issueToken(admin);
      await User.updateOne({ _id: admin._id }, { role: 'trainer' });
      assert.equal((await request(token)).status, 403);
      await User.updateOne({ _id: admin._id }, { role: 'admin', active: false });
      assert.equal((await request(token)).status, 401);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === db) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
