import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Payment from '../src/models/Payment.js';
import Membership from '../src/models/Membership.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import { issueToken } from '../src/services/tokenService.js';
import { enroll, renew, memberMembership } from '../src/services/membershipService.js';
import { paymentStats, list as listPayments } from '../src/services/paymentService.js';

process.env.JWT_SECRET = randomBytes(48).toString('hex');
const db = `fittrack_test_payments_${randomUUID().replaceAll('-', '')}`;
test('simulated membership payments with isolated MongoDB', { timeout: 60000 }, async t => {
  let server;
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${db}`, { serverSelectionTimeoutMS: 5000, autoIndex: false });
    await t.test('legacy payments survive index creation and current duplicates remain blocked', async () => {
      const legacy = await Payment.collection.insertMany([{ member: new mongoose.Types.ObjectId(), createdAt: new Date() }, { member: new mongoose.Types.ObjectId(), createdAt: new Date() }]);
      await Payment.createIndexes();
      assert.equal(await Payment.countDocuments({ _id: { $in: Object.values(legacy.insertedIds) } }), 2);
      assert.deepEqual((await paymentStats()).recent, []);
      assert.equal((await listPayments({ page: 1, status: 'all' }, { role: 'admin' })).pagination.total, 0);
      const current = { memberId: new mongoose.Types.ObjectId(), periodId: new mongoose.Types.ObjectId() };
      const inserted = await Payment.collection.insertOne(current);
      await assert.rejects(Payment.collection.insertOne({ ...current, _id: new mongoose.Types.ObjectId() }), error => error.code === 11000);
      // These fixtures belong only to this randomly named test database.
      await Payment.deleteMany({ _id: { $in: [...Object.values(legacy.insertedIds), inserted.insertedId] } });
    });
    const make = role => User.create({ name: `Payment ${role}`, email: `${randomUUID()}@example.test`, role, passwordHash: 'fixture-only' });
    const admin = await make('admin'), trainer = await make('trainer'), member = await make('member'), other = await make('member');
    const plan = await MembershipPlan.create({ name: 'Original price', nameKey: 'original price', durationDays: 30, priceMinor: 12345, currency: 'INR', features: [] });
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    await enroll(member.id, { planId: plan.id, startAt: today }, admin.id);
    await enroll(other.id, { planId: plan.id, startAt: today }, admin.id);
    const periodId = (await memberMembership(member.id)).membership.latest.id;
    const otherPeriod = (await memberMembership(other.id)).membership.latest.id;
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(path = '', { actor = member, method = 'GET', body } = {}) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/payments${path}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${issueToken(actor)}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json(), headers: response.headers };
    }
    const post = (path, body, actor = member) => request(path, { method: 'POST', body, actor });
    let payment;
    await t.test('guests and trainers denied; members cannot choose another member or price', async () => {
      assert.equal((await request('', { actor: null })).status, 401);
      assert.equal((await request('', { actor: trainer })).status, 403);
      assert.equal((await post('', { periodId }, trainer)).status, 403);
      for (const body of [[], { periodId, memberId: other.id }, { periodId, amountMinor: 1 }, { periodId, status: 'paid' }, { periodId, mode: 'real' }, { periodId: { $ne: null } }, { periodId: 'bad' }]) assert.equal((await post('', body)).status, 400);
      assert.equal((await post('', { periodId: otherPeriod })).status, 404);
      assert.equal((await post('', { periodId }, admin)).status, 400);
      for (const query of ['?status=refunded', '?page=0', '?q[x]=1', '?page=1&page=2', `?memberId=${other.id}`]) assert.equal((await request(query)).status, 400);
    });
    await t.test('concurrent creation and retries return one pending record using saved plan price', async () => {
      await MembershipPlan.updateOne({ _id: plan._id }, { priceMinor: 99999, name: 'New price', active: false });
      const results = await Promise.all([post('', { periodId }), post('', { periodId, memberId: member.id }, admin)]);
      assert.ok(results.every(result => result.status === 200));
      assert.equal(results[0].data.payment.id, results[1].data.payment.id);
      payment = results[0].data.payment;
      assert.equal(payment.status, 'pending'); assert.equal(payment.amountMinor, 12345); assert.equal(payment.planName, 'Original price');
      assert.equal(payment.mode, 'simulation'); assert.equal(payment.events.length, 1);
      assert.equal(results[0].headers.get('cache-control'), 'no-store');
      assert.equal(await Payment.countDocuments(), 1);
    });
    await t.test('ownership and strict transition fields protect records', async () => {
      assert.equal((await post(`/${payment.id}/simulate`, { expectedVersion: 1, outcome: 'paid' }, other)).status, 404);
      assert.equal((await request('', { actor: other })).data.records.length, 0);
      for (const body of [{ outcome: 'paid' }, { expectedVersion: 1, outcome: 'pending' }, { expectedVersion: 1, outcome: 'paid', paidAt: today }, { expectedVersion: 1.2, outcome: 'paid' }]) assert.equal((await post(`/${payment.id}/simulate`, body)).status, 400);
      assert.equal((await post('/bad/simulate', { expectedVersion: 1, outcome: 'paid' })).status, 400);
      assert.equal((await post(`/${payment.id}/retry`, { expectedVersion: 1 })).status, 409);
      assert.equal((await paymentStats()).totalMinor, 0);
    });
    await t.test('failure and retry preserve audit history and reject stale versions', async () => {
      const failed = await post(`/${payment.id}/simulate`, { expectedVersion: 1, outcome: 'failed' });
      assert.equal(failed.status, 200); assert.equal(failed.data.payment.status, 'failed');
      assert.equal((await paymentStats()).totalMinor, 0);
      assert.equal((await post(`/${payment.id}/simulate`, { expectedVersion: 2, outcome: 'paid' })).status, 409);
      assert.equal((await post(`/${payment.id}/retry`, { expectedVersion: 1 })).status, 409);
      const retry = await post(`/${payment.id}/retry`, { expectedVersion: 2 });
      assert.equal(retry.status, 200); assert.equal(retry.data.payment.version, 3);
      assert.deepEqual(retry.data.payment.events.map(event => event.status), ['pending', 'failed', 'pending']);
    });
    await t.test('concurrent success counts once and cannot be reversed or paid twice', async () => {
      const before = await Membership.findById(member.id).lean();
      const results = await Promise.all([post(`/${payment.id}/simulate`, { expectedVersion: 3, outcome: 'paid' }), post(`/${payment.id}/simulate`, { expectedVersion: 3, outcome: 'paid' }, admin)]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      assert.equal((await post(`/${payment.id}/simulate`, { expectedVersion: 4, outcome: 'failed' })).status, 409);
      assert.equal((await post(`/${payment.id}/retry`, { expectedVersion: 4 })).status, 409);
      const reopened = (await post('', { periodId })).data.payment;
      assert.equal(reopened.status, 'paid'); assert.equal(reopened.id, payment.id);
      const stats = await paymentStats();
      assert.equal(stats.totalMinor, 12345); assert.equal(stats.monthMinor, 12345); assert.equal(stats.paidCount, 1);
      assert.deepEqual(await Membership.findById(member.id).lean(), before);
    });
    await t.test('renewals create distinct payments and zero-price periods remain supported', async () => {
      await MembershipPlan.updateOne({ _id: plan._id }, { active: true, priceMinor: 0 });
      await renew(member.id, { planId: plan.id, expectedVersion: 1 }, admin.id);
      const renewal = (await memberMembership(member.id)).membership.latest;
      const created = (await post('', { periodId: renewal.id })).data.payment;
      assert.notEqual(created.id, payment.id); assert.equal(created.amountMinor, 0);
      assert.equal((await post(`/${created.id}/simulate`, { expectedVersion: 1, outcome: 'paid' })).status, 200);
      assert.equal((await paymentStats()).totalMinor, 12345);
      assert.equal((await paymentStats()).paidCount, 2);
    });
    await t.test('inactive and archived members retain history but cannot change payments', async () => {
      const created = (await post('', { periodId: otherPeriod }, other)).data.payment;
      await User.updateOne({ _id: other._id }, { active: false });
      assert.equal((await post(`/${created.id}/simulate`, { expectedVersion: 1, outcome: 'paid' }, admin)).status, 409);
      assert.equal((await post('', { periodId: otherPeriod, memberId: other.id }, admin)).status, 409);
      assert.equal((await request('', { actor: other })).status, 401);
      await User.updateOne({ _id: other._id }, { active: true, archivedAt: new Date() });
      assert.equal((await post(`/${created.id}/simulate`, { expectedVersion: 1, outcome: 'paid' }, admin)).status, 409);
      assert.equal((await request(`?memberId=${other.id}`, { actor: admin })).data.records.length, 1);
      assert.equal((await paymentStats()).totalMinor, 12345);
    });
    await t.test('revenue uses paid timestamp with exact UTC month boundaries and no future totals', async () => {
      const now = new Date('2026-02-15T12:00:00Z');
      await Payment.updateMany({}, { status: 'failed', paidAt: null });
      const base = { memberId: member._id, memberName: 'Boundary', planName: 'Saved', startAt: today, expiresAt: today, events: [], status: 'paid' };
      for (const [paidAt, amountMinor] of [['2026-01-31T23:59:59.999Z', 1], ['2026-02-01T00:00:00Z', 2], ['2026-02-15T12:00:00Z', 4], ['2026-02-15T12:00:00.001Z', 8]]) await Payment.create({ ...base, periodId: new mongoose.Types.ObjectId(), amountMinor, paidAt });
      const stats = await paymentStats(now);
      assert.equal(stats.totalMinor, 7); assert.equal(stats.monthMinor, 6); assert.equal(stats.paidCount, 3);
    });
    await t.test('history is paginated, searchable literally, filterable, and excludes private data', async () => {
      for (let i = 0; i < 8; i++) await Payment.create({ memberId: member._id, periodId: new mongoose.Types.ObjectId(), memberName: 'Paged', planName: 'Saved', startAt: today, expiresAt: today, amountMinor: 100, events: [] });
      const first = (await request()).data, second = (await request('?page=2')).data;
      assert.equal(first.records.length, 10); assert.equal(second.records.length, 4);
      assert.equal(new Set([...first.records, ...second.records].map(row => row.id)).size, 14);
      assert.equal((await request('?q=.*', { actor: admin })).data.records.length, 0);
      assert.equal((await request('?q=paged', { actor: admin })).data.records.length, 8);
      assert.equal((await request('?status=pending')).data.records.length, 8);
      const all = JSON.stringify(first);
      assert.doesNotMatch(all, /passwordHash|tokenVersion|actorId|email/);
      assert.equal((await request('', { actor: admin })).data.pagination.total, 15);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === db) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
