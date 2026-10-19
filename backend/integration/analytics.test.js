import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Attendance from '../src/models/Attendance.js';
import Payment from '../src/models/Payment.js';
import Session from '../src/models/Session.js';
import { issueToken } from '../src/services/tokenService.js';
import { analyticsQuery } from '../src/validators/analyticsValidators.js';
import { analytics } from '../src/services/analyticsService.js';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const database = `fittrack_test_analytics_${randomUUID().replaceAll('-', '')}`;
const now = new Date('2026-03-02T12:00:00Z');
const query = { from: '2026-02-28', to: '2026-03-02', interval: 'day' };
test('analytics against isolated MongoDB', { timeout: 30000 }, async t => {
  let server;
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([User.init(), Attendance.init(), Payment.init(), Session.init()]);
    await t.test('empty days and partial months are zero-filled', async () => {
      const result = await analytics(query, now);
      assert.deepEqual(result.rows.map(row => row.period), ['2026-02-28','2026-03-01','2026-03-02']);
      assert.ok(Object.values(result.totals).every(value => value === 0));
      assert.deepEqual((await analytics({ ...query, interval: 'month' }, now)).rows.map(row => row.period), ['2026-02','2026-03']);
    });
    const make = role => ({ name: `Analytics ${role}`, email: `${randomUUID()}@example.test`, passwordHash: 'unused-test-hash', role });
    const [admin, member, trainer] = await User.create([make('admin'),make('member'),make('trainer')]);
    await User.collection.updateOne({ _id: member._id }, { $set: { createdAt: new Date('2026-02-28T00:00:00Z'), archivedAt: now, active: false } });
    await User.collection.insertMany([
      { ...make('member'), createdAt: new Date('2026-02-27T23:59:59.999Z') },
      { ...make('member'), createdAt: now },
      { ...make('member'), createdAt: new Date(+now + 1) },
    ]);
    await Attendance.collection.insertMany([
      { memberId: member._id, checkedInAt: new Date('2026-02-28T00:00:00Z') },
      { memberId: member._id, checkedInAt: now },
      { memberId: trainer._id, checkedInAt: new Date('2026-03-01T02:00:00Z') },
      { memberId: trainer._id, checkedInAt: new Date('2026-02-27T23:59:59.999Z') },
      { memberId: trainer._id, checkedInAt: new Date(+now + 1) },
    ].map(row => ({ ...row, day: row.checkedInAt.toISOString().slice(0, 10) })));
    await Payment.collection.insertMany([
      { status: 'paid', mode: 'simulation', currency: 'INR', paidAt: new Date('2026-02-28T00:00:00Z'), amountMinor: 1050 },
      { status: 'paid', mode: 'simulation', currency: 'INR', paidAt: now, amountMinor: 2035 },
      { status: 'failed', mode: 'simulation', currency: 'INR', paidAt: now, amountMinor: 9999 },
      { status: 'pending', mode: 'simulation', currency: 'INR', paidAt: now, amountMinor: 9999 },
      { status: 'paid', mode: 'simulation', currency: 'INR', paidAt: new Date(+now + 1), amountMinor: 9999 },
    ].map(row => ({ ...row, memberId: member._id, periodId: new mongoose.Types.ObjectId() })));
    await Session.collection.insertMany([
      { startAt: new Date('2026-02-28T00:00:00Z'), status: 'completed' },
      { startAt: now, status: 'cancelled' },
      { startAt: now, status: 'scheduled' },
      { startAt: new Date(+now + 1), status: 'scheduled' },
    ].map((row, i) => ({ ...row, reservations: [String(i)] })));
    await t.test('inclusive bounds, current-time cutoff, retained history and distinct visitors', async () => {
      const data = await analytics(query, now);
      assert.deepEqual(data.totals, { registrations: 2, visits: 3, revenueMinor: 3085, paidPayments: 2, scheduled: 1, completed: 1, cancelled: 1, uniqueVisitors: 2 });
      assert.deepEqual(data.rows.map(row => row.revenueMinor), [1050,0,2035]);
      assert.deepEqual(data.rows.map(row => row.registrations), [1,0,1]);
      const monthly = await analytics({ ...query, interval: 'month' }, now);
      assert.deepEqual(monthly.totals, data.totals);
      assert.deepEqual(monthly.rows.map(row => row.visits), [1,2]);
      const oneDay = await analytics({ from: '2026-02-28', to: '2026-02-28', interval: 'day' }, now);
      assert.equal(oneDay.totals.visits, 1);
    });
    await t.test('validates real calendar dates, limits, duplicates, operators and unsupported inputs', () => {
      for (const value of [{ from: '2026-02-30' },{ to: '2026-03-03' },{ from: '2026-03-02', to: '2026-03-01' },{ from: '2024-01-01', to: '2026-01-01' },{ from: ['2026-01-01'] },{ from: { $gte: '2026-01-01' } },{ interval: ['day'] },{ interval: 'year' },{ page: '1' },{ memberId: 'x' }]) assert.throws(() => analyticsQuery(value, now), { status: 400 });
      assert.equal(analyticsQuery({}, now).to, '2026-03-02');
      assert.equal(analyticsQuery({ from: '2025-03-02', to: '2026-03-02' }, now).from, '2025-03-02');
      assert.equal(analyticsQuery({ from: '2024-02-29', to: '2024-02-29' }, now).from, '2024-02-29');
    });
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const request = (actor, query = '') => fetch(`http://127.0.0.1:${server.address().port}/api/analytics${query}`, { headers: actor ? { Authorization: `Bearer ${issueToken(actor)}` } : {} });
    await t.test('admin-only HTTP, no-store, invalid query and disabled-account protection', async () => {
      assert.equal((await request()).status, 401);
      assert.equal((await request(trainer)).status, 403);
      await User.updateOne({ _id: member._id }, { archivedAt: null, active: true });
      assert.equal((await request(member)).status, 403);
      const response = await request(admin, '?from=2026-02-28&to=2026-03-02&interval=day');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const data = await response.json();
      assert.equal(data.rows.length, 3);
      assert.ok(!JSON.stringify(data).includes(member.email));
      for (const q of ['?interval=year','?from=2026-01-01&from=2026-02-01','?page=1']) assert.equal((await request(admin,q)).status,400);
      await User.updateOne({ _id: admin._id }, { active: false });
      assert.equal((await request(admin)).status,401);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});


