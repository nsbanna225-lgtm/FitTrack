import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Session from '../src/models/Session.js';
import Membership from '../src/models/Membership.js';
import Payment from '../src/models/Payment.js';
import WorkoutAssignment from '../src/models/WorkoutAssignment.js';
import Notification from '../src/models/Notification.js';
import { issueToken } from '../src/services/tokenService.js';
import * as service from '../src/services/notificationService.js';

process.env.JWT_SECRET = randomBytes(48).toString('hex');
const db = `fittrack_test_notifications_${randomUUID().replaceAll('-', '')}`;
const DAY = 86400000;
test('notifications with isolated MongoDB', { timeout: 60000 }, async t => {
  let server;
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${db}`, { serverSelectionTimeoutMS: 5000, autoIndex: false });
    await t.test('legacy notifications survive index creation and current duplicates remain blocked', async () => {
      const legacy = await Notification.collection.insertMany([{ recipient: new mongoose.Types.ObjectId() }, { recipient: new mongoose.Types.ObjectId() }]);
      await Notification.createIndexes();
      assert.equal(await Notification.countDocuments({ _id: { $in: Object.values(legacy.insertedIds) } }), 2);
      const current = { recipientId: new mongoose.Types.ObjectId(), key: 'legacy-index-regression' };
      const inserted = await Notification.collection.insertOne(current);
      await assert.rejects(Notification.collection.insertOne({ ...current, _id: new mongoose.Types.ObjectId() }), error => error.code === 11000);
      await Notification.deleteMany({ _id: { $in: [...Object.values(legacy.insertedIds), inserted.insertedId] } });
    });
    const make = role => User.create({ name: `Notice ${role}`, email: `${randomUUID()}@example.test`, role, passwordHash: 'fixture-only' });
    const member = await make('member'), other = await make('member'), trainer = await make('trainer'), admin = await make('admin');
    const now = new Date(), date = delta => new Date(+now + delta), oid = () => new mongoose.Types.ObjectId();
    const sessionId = oid(), paymentId = oid(), workoutId = oid();
    await Session.collection.insertOne({ _id: sessionId, memberId: member._id, trainerId: trainer._id, memberName: member.name, trainerName: trainer.name, status: 'scheduled', version: 1, startAt: date(DAY / 2), endAt: date(DAY / 2 + 3600000), createdAt: date(-3600000), updatedAt: date(-3600000) });
    await Membership.collection.insertOne({ _id: member._id, periods: [{ _id: oid(), startAt: date(-30 * DAY), expiresAt: date(3 * DAY) }] });
    await Payment.collection.insertOne({ _id: paymentId, memberId: member._id, planName: 'Monthly', amountMinor: 149900, currency: 'INR', status: 'pending', mode: 'simulation', version: 1, updatedAt: date(-3600000) });
    await WorkoutAssignment.collection.insertOne({ _id: workoutId, memberId: member._id, name: 'Strength & mobility', createdAt: date(-DAY), archived: false, archivedAt: null });
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const query = { page: 1, status: 'all', kind: 'all' };
    async function request(path = '', { actor = member, method = 'GET', body } = {}) {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/notifications${path}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${issueToken(actor)}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: res.status, data: await res.json(), headers: res.headers };
    }
    await t.test('all five categories generated once under concurrent refresh; safe role-scoped links', async () => {
      const [a, b] = await Promise.all([service.list(query, member, now), service.list(query, member, now)]);
      assert.equal(a.records.length, 5); assert.equal(b.records.length, 5);
      assert.deepEqual(a.records.map(r => r.kind).sort(), ['booking', 'membership_expiry', 'payment_reminder', 'session_reminder', 'workout_update']);
      assert.equal(await Notification.countDocuments({ recipientId: member._id }), 5);
      assert.ok(a.records.every(r => r.href.startsWith('/member/')));
      assert.match(a.records.find(r => r.kind === 'payment_reminder').message, /1499.00.*simulation/);
      assert.equal((await service.list(query, trainer, now)).records.length, 2);
      assert.ok((await service.list(query, trainer, now)).records.every(r => r.href.startsWith('/trainer/')));
      assert.equal((await service.list(query, other, now)).records.length, 0);
      assert.equal((await service.list(query, admin, now)).records.length, 0);
    });
    await t.test('read state survives repeated sync, is idempotent, and supports unread/category filters', async () => {
      const row = (await service.list(query, member, now)).records.find(r => r.kind === 'payment_reminder');
      await service.mark(row.id, true, member, now);
      await service.mark(row.id, true, member, date(1000));
      const read = await service.list({ ...query, status: 'read' }, member, date(2000));
      assert.equal(read.records.length, 1); assert.equal(+new Date(read.records[0].readAt), +now);
      assert.equal(read.unread, 4);
      assert.equal((await service.list({ ...query, kind: 'payment_reminder', status: 'unread' }, member, now)).records.length, 0);
      await service.mark(row.id, false, member, now);
      assert.equal((await service.unread(member, now)).unread, 5);
    });
    await t.test('HTTP ownership, no-store, role isolation, and strict query/body validation', async () => {
      assert.equal((await request('', { actor: null })).status, 401);
      const response = await request();
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.doesNotMatch(JSON.stringify(response.data), /passwordHash|tokenVersion|recipientId|email|"key"/);
      const pushConfig = await request('/push-config');
      assert.equal(pushConfig.status, 200);
      assert.deepEqual(pushConfig.data, { enabled: false, publicKey: null });
      assert.equal((await request('/push-config', { actor: null })).status, 401);
      const subscription = { endpoint: 'https://push.example.test/sub', keys: { p256dh: 'public', auth: 'secret' } };
      assert.equal((await request('/push-subscriptions', { method: 'PUT', body: subscription })).status, 503);
      assert.equal((await request('/push-subscriptions', { method: 'PUT', body: { ...subscription, endpoint: 'http://push.example.test/sub' } })).status, 400);
      assert.equal((await request('/push-subscriptions', { method: 'PUT', body: { ...subscription, extra: true } })).status, 400);
      const row = response.data.records[0];
      assert.equal((await request(`/${row.id}/read`, { actor: other, method: 'PATCH', body: { read: true } })).status, 404);
      assert.equal((await request(`/${row.id}/read`, { actor: admin, method: 'PATCH', body: { read: true } })).status, 404);
      for (const path of ['?recipientId=x', '?page=0', '?status=pending', '?kind=all&kind=booking', '?q[x]=1', '/unread?userId=x']) assert.equal((await request(path)).status, 400, path);
      for (const body of [[], {}, { read: 'true' }, { read: true, recipientId: other.id }, { read: true, readAt: now }]) assert.equal((await request(`/${row.id}/read`, { method: 'PATCH', body })).status, 400);
      assert.equal((await request('/bad/read', { method: 'PATCH', body: { read: true } })).status, 400);
      assert.equal((await request(`/${row.id}/read`, { method: 'PATCH', body: { read: true } })).status, 200);
      await User.updateOne({ _id: other._id }, { active: false });
      assert.equal((await request('', { actor: other })).status, 401);
    });
    await t.test('reschedule replaces booking/reminder keys; cancellation removes upcoming reminders', async () => {
      const before = (await service.list(query, member, now)).records.find(r => r.kind === 'booking');
      await service.mark(before.id, true, member, now);
      await Session.collection.updateOne({ _id: sessionId }, { $set: { version: 2, startAt: date(3 * DAY), updatedAt: now } });
      const after = await service.list(query, member, now);
      assert.equal(after.records.some(r => r.kind === 'session_reminder'), false);
      const updated = after.records.find(r => r.kind === 'booking');
      assert.notEqual(updated.id, before.id); assert.equal(updated.readAt, null); assert.equal(updated.title, 'Session rescheduled');
      await assert.rejects(service.mark(before.id, true, member, now), error => error.status === 404 || error.statusCode === 404);
      await Session.collection.updateOne({ _id: sessionId }, { $set: { version: 3, status: 'cancelled', updatedAt: now } });
      const cancelled = await service.list(query, member, now);
      assert.equal(cancelled.records.find(r => r.kind === 'booking').title, 'Session cancelled');
      assert.equal(cancelled.records.some(r => r.kind === 'session_reminder'), false);
    });
    await t.test('24-hour and 30-day boundaries exclude started sessions and old events', async () => {
      await Session.collection.updateOne({ _id: sessionId }, { $set: { status: 'scheduled', version: 4, startAt: date(DAY), updatedAt: date(-30 * DAY) } });
      let rows = await service.candidates(member, now);
      assert.equal(rows.filter(r => r.kind === 'booking').length, 0);
      assert.equal(rows.filter(r => r.kind === 'session_reminder').length, 1);
      await Session.collection.updateOne({ _id: sessionId }, { $set: { startAt: date(DAY + 1) } });
      assert.equal((await service.candidates(member, now)).filter(r => r.kind === 'session_reminder').length, 0);
      await Session.collection.updateOne({ _id: sessionId }, { $set: { startAt: now } });
      assert.equal((await service.candidates(member, now)).filter(r => r.kind === 'session_reminder').length, 0);
    });
    await t.test('continuous renewal suppresses premature expiry; gaps and expiry boundaries respected', async () => {
      await Membership.collection.updateOne({ _id: member._id }, { $push: { periods: { _id: oid(), startAt: date(3 * DAY), expiresAt: date(33 * DAY) } } });
      assert.equal((await service.candidates(member, now)).filter(r => r.kind === 'membership_expiry').length, 0);
      await Membership.collection.updateOne({ _id: member._id }, { $set: { periods: [{ _id: oid(), startAt: date(-DAY), expiresAt: date(7 * DAY) }] } });
      assert.equal((await service.candidates(member, now)).find(r => r.kind === 'membership_expiry').title, 'Membership expires soon');
      await Membership.collection.updateOne({ _id: member._id }, { $set: { 'periods.0.expiresAt': date(7 * DAY + 1) } });
      assert.equal((await service.candidates(member, now)).filter(r => r.kind === 'membership_expiry').length, 0);
      await Membership.collection.updateOne({ _id: member._id }, { $set: { periods: [{ _id: oid(), startAt: date(-DAY), expiresAt: now }, { _id: oid(), startAt: date(2 * DAY), expiresAt: date(32 * DAY) }] } });
      assert.equal((await service.candidates(member, now)).find(r => r.kind === 'membership_expiry').title, 'Membership has expired');
      assert.equal((await service.candidates(member, date(2 * DAY))).filter(r => r.kind === 'membership_expiry').length, 0);
      await Membership.collection.updateOne({ _id: member._id }, { $set: { periods: [{ _id: oid(), startAt: date(-30 * DAY), expiresAt: date(-7 * DAY) }] } });
      assert.equal((await service.candidates(member, now)).filter(r => r.kind === 'membership_expiry').length, 0);
    });
    await t.test('paid reminders disappear; failure/retry create fresh unread states; archived workouts replace assignments', async () => {
      const pending = (await service.list(query, member, now)).records.find(r => r.kind === 'payment_reminder');
      await service.mark(pending.id, true, member, now);
      await Payment.collection.updateOne({ _id: paymentId }, { $set: { status: 'failed', version: 2, updatedAt: now } });
      const failed = (await service.list(query, member, now)).records.find(r => r.kind === 'payment_reminder');
      assert.notEqual(pending.id, failed.id); assert.equal(failed.readAt, null); assert.match(failed.title, /retry/);
      await Payment.collection.updateOne({ _id: paymentId }, { $set: { status: 'pending', version: 3, updatedAt: now } });
      assert.match((await service.list(query, member, now)).records.find(r => r.kind === 'payment_reminder').title, /pending/);
      await Payment.collection.updateOne({ _id: paymentId }, { $set: { status: 'paid', version: 4, updatedAt: now } });
      assert.equal((await service.list(query, member, now)).records.some(r => r.kind === 'payment_reminder'), false);
      await WorkoutAssignment.collection.updateOne({ _id: workoutId }, { $set: { archived: true, archivedAt: now } });
      const workout = (await service.list(query, member, now)).records.filter(r => r.kind === 'workout_update');
      assert.equal(workout.length, 1); assert.equal(workout[0].title, 'Workout archived');
      assert.equal((await service.list(query, { ...member.toObject(), archivedAt: now }, now)).records.length, 0);
    });
    await t.test('newest-first stable pagination and read counts span the whole eligible inbox', async () => {
      for (let i = 0; i < 23; i++) await WorkoutAssignment.collection.insertOne({ _id: oid(), memberId: other._id, name: `Plan ${i}`, createdAt: date(-i * 1000), archived: false });
      const first = await service.list(query, other, now), second = await service.list({ ...query, page: 2 }, other, now), third = await service.list({ ...query, page: 3 }, other, now);
      assert.equal(first.records.length, 10); assert.equal(second.records.length, 10); assert.equal(third.records.length, 3);
      assert.equal(first.pagination.total, 23); assert.equal(third.unread, 23);
      assert.equal(new Set([...first.records, ...second.records, ...third.records].map(r => r.id)).size, 23);
      assert.match(first.records[0].message, /^Plan 0\./);
      await service.mark(first.records[0].id, true, other, now);
      assert.equal((await service.list({ ...query, page: 3 }, other, now)).unread, 22);
      assert.equal((await service.list(query, other, date(31 * DAY))).records.length, 0);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === db) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
