import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Trainer from '../src/models/Trainer.js';
import Membership from '../src/models/Membership.js';
import Session from '../src/models/Session.js';
import { issueToken } from '../src/services/tokenService.js';
import { book, reschedule, changeStatus, availableSlots, withinHours, covered, upcomingSessions } from '../src/services/sessionService.js';

process.env.JWT_SECRET = randomBytes(48).toString('hex');
const database = `fittrack_test_sessions_${randomUUID().replaceAll('-', '')}`;
test('session scheduling with isolated standalone MongoDB', { timeout: 60000 }, async t => {
  let server;
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, { serverSelectionTimeoutMS: 5000, autoIndex: false });
    await Session.createIndexes();
    const make = role => User.create({ name: `Session ${role}`, email: `${randomUUID()}@example.test`, role, passwordHash: 'fixture-only' });
    const admin = await make('admin'), trainer = await make('trainer'), trainer2 = await make('trainer'), member = await make('member'), member2 = await make('member'), outsider = await make('member');
    const now = new Date(), tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2));
    const at = (hour, minute = 0) => new Date(+tomorrow + hour * 3600000 + minute * 60000);
    for (const tr of [trainer, trainer2]) await Trainer.create({ _id: tr._id, timezone: 'UTC', availability: Array.from({ length: 7 }, (_, day) => ({ day, start: '08:00', end: '18:00' })) });
    for (const m of [member, member2]) await Membership.create({ _id: m._id, periods: [{ planId: new mongoose.Types.ObjectId(), planName: 'Test coverage', durationDays: 30, priceMinor: 0, currency: 'INR', features: [], startAt: tomorrow, expiresAt: new Date(+tomorrow + 30 * 86400000), recordedAt: now, recordedBy: admin._id }] });
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(path = '', { method = 'GET', body, actor = admin } = {}) {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/sessions${path}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${issueToken(actor)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: res.status, data: await res.json(), headers: res.headers };
    }
    const fields = (hour, m = member, tr = trainer, minute = 0) => ({ trainerId: tr.id, memberId: m.id, startAt: at(hour, minute), durationMinutes: 60 });
    const query = `?from=${tomorrow.toISOString().slice(0,10)}&to=${new Date(+tomorrow + 86400000).toISOString().slice(0,10)}`;
    const slotQuery = { trainerId: trainer.id, memberId: member.id, date: tomorrow, durationMinutes: 60 };
    let first;
    await t.test('guests and roles are rejected before mutations; query and body fields are restricted', async () => {
      assert.equal((await request('', { actor: null })).status, 401);
      assert.equal((await request('', { actor: trainer, method: 'POST', body: {} })).status, 403);
      assert.equal((await request('/slots', { actor: trainer })).status, 403);
      for (const body of [{ ...fields(9), durationMinutes: 17 }, { ...fields(9), status: 'completed' }, { ...fields(9), startAt: '2028-02-30T09:00:00.000Z' }, { ...fields(9), startAt: at(9,1).toISOString() }]) assert.equal((await request('', { method: 'POST', body })).status, 400);
      assert.equal((await request('', { method: 'POST', actor: member, body: fields(9) })).status, 400);
      assert.equal((await request('?trainerId=' + trainer.id, { actor: member })).status, 400);
      assert.equal((await request('?from=2028-01-01&to=2027-01-01')).status, 400);
      assert.equal((await request('?page=0')).status, 400);
    });
    await t.test('trainer options expose only bookable profiles and public fields', async () => {
      const noHours = await make('trainer');
      const result = await request('/trainers', { actor: member });
      assert.equal(result.status, 200); assert.equal(result.data.pagination.total, 2);
      assert.ok(result.data.trainers.every(tr => tr.id !== noHours.id && !('email' in tr) && !('bio' in tr)));
      assert.equal((await request('/trainers?q=.*')).data.trainers.length, 0);
    });
    await t.test('availability checks published hours, account eligibility, coverage and booking horizon', async () => {
      const result = await availableSlots(slotQuery, admin, now);
      assert.equal(result.timezone, 'UTC'); assert.ok(result.slots.some(s => +s.startAt === +at(9)));
      assert.ok(result.slots.every(s => s.startAt.getUTCHours() >= 8 && +s.endAt <= +at(18)));
      assert.equal((await availableSlots({ ...slotQuery, memberId: outsider.id }, admin, now)).slots.length, 0);
      await assert.rejects(book(fields(7), admin, now), { status: 409 });
      await assert.rejects(book(fields(9, outsider), admin, now), { status: 409 });
      await assert.rejects(book({ ...fields(9), startAt: now }, admin, now), { status: 400 });
      await assert.rejects(book({ ...fields(9), startAt: new Date(+now + 181 * 86400000) }, admin, now), { status: 400 });
      await User.updateOne({ _id: trainer._id }, { active: false });
      await assert.rejects(book(fields(9), admin, now), { status: 409 });
      await User.updateOne({ _id: trainer._id }, { active: true });
      await User.updateOne({ _id: member._id }, { archivedAt: now });
      await assert.rejects(book(fields(9), admin, now), { status: 409 });
      await User.updateOne({ _id: member._id }, { archivedAt: null });
    });
    await t.test('concurrent trainer bookings allow only one reservation', async () => {
      const results = await Promise.allSettled([book(fields(9), admin, now), book(fields(9, member2), admin, now)]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
      first = results.find(r => r.status === 'fulfilled').value;
      assert.equal(await Session.countDocuments(), 1);
    });
    await t.test('member conflicts across trainers and partial overlaps are rejected; adjacent times allowed', async () => {
      const bookedMember = first.memberId === member.id ? member : member2;
      await assert.rejects(book(fields(9, bookedMember, trainer2), admin, now), { status: 409 });
      await assert.rejects(book(fields(9, bookedMember, trainer, 45), admin, now), { status: 409 });
      const adjacent = await book(fields(10, bookedMember), admin, now);
      assert.equal(+adjacent.startAt, +first.endAt);
    });
    await t.test('failed reschedule keeps original slot; concurrent updates use optimistic versions', async () => {
      await assert.rejects(reschedule(first.id, { startAt: at(10), durationMinutes: 60, expectedVersion: 1 }, admin, now), { status: 409 });
      assert.equal(+(await Session.findById(first.id)).startAt, +at(9));
      const results = await Promise.allSettled([reschedule(first.id, { startAt: at(11), durationMinutes: 60, expectedVersion: 1 }, admin, now), reschedule(first.id, { startAt: at(12), durationMinutes: 60, expectedVersion: 1 }, admin, now)]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
      first = results.find(r => r.status === 'fulfilled').value;
      assert.equal(first.version, 2);
    });
    await t.test('member self-booking is scoped and unrelated users cannot cancel or reschedule', async () => {
      const created = await request('', { actor: member, method: 'POST', body: { trainerId: trainer2.id, startAt: at(14).toISOString(), durationMinutes: 30 } });
      assert.equal(created.status, 201); assert.equal(created.data.session.memberId, member.id);
      assert.equal(created.headers.get('cache-control'), 'no-store');
      const id = created.data.session.id;
      assert.equal((await request(`/${id}/cancel`, { actor: outsider, method: 'POST', body: { expectedVersion: 1 } })).status, 404);
      assert.equal((await request(`/${id}`, { actor: outsider, method: 'PATCH', body: { expectedVersion: 1, startAt: at(15).toISOString(), durationMinutes: 30 } })).status, 404);
      assert.equal((await request(`/${id}/cancel`, { actor: trainer, method: 'POST', body: { expectedVersion: 1 } })).status, 404);
      assert.equal((await request(`/${id}/complete`, { actor: member, method: 'POST', body: { expectedVersion: 1 } })).status, 403);
      const mine = (await request(query, { actor: member })).data.sessions;
      assert.ok(mine.length && mine.every(s => s.memberId === member.id));
      assert.ok(!JSON.stringify(mine).includes('reservations') && !JSON.stringify(mine).includes('createdBy'));
      assert.ok((await request(query, { actor: trainer })).data.sessions.every(s => s.trainerId === trainer.id));
      assert.equal((await request(query, { actor: outsider })).data.sessions.length, 0);
    });
    await t.test('cancel releases both participants atomically; stale cancellation cannot remove new reservation', async () => {
      await assert.rejects(changeStatus(first.id, 1, 'cancelled', admin, now), { status: 409 });
      await changeStatus(first.id, first.version, 'cancelled', trainer, now);
      const replacement = await book({ ...fields(9), startAt: first.startAt }, admin, now);
      assert.equal(replacement.status, 'scheduled');
      await assert.rejects(changeStatus(first.id, first.version, 'cancelled', admin, now), { status: 409 });
      assert.ok((await Session.findById(replacement.id)).reservations.length > 0);
      await changeStatus(replacement.id, replacement.version, 'cancelled', admin, now);
      // Multiple cancelled empty reservation arrays must not collide in the unique index.
      assert.equal(await Session.countDocuments({ status: 'cancelled' }), 2);
    });
    await t.test('available times omit overlaps and exclude only an authorized session during rescheduling', async () => {
      const result = await availableSlots(slotQuery, admin, now);
      assert.ok(!result.slots.some(s => +s.startAt === +at(10)));
      const own = await Session.findOne({ trainerId: trainer._id, startAt: at(10) });
      const included = await availableSlots({ ...slotQuery, memberId: String(own.memberId), excludeId: own.id }, admin, now);
      assert.ok(included.slots.some(s => +s.startAt === +at(10)));
      await assert.rejects(availableSlots({ ...slotQuery, excludeId: own.id }, outsider, now), { status: 404 });
    });
    await t.test('completion requires session end and preserves history; past sessions cannot cancel or move', async () => {
      const doc = await Session.findOne({ status: 'scheduled' });
      await assert.rejects(changeStatus(doc.id, doc.version, 'completed', admin, now), { status: 409 });
      const after = new Date(+doc.endAt + 1);
      await assert.rejects(changeStatus(doc.id, doc.version, 'cancelled', admin, after), { status: 409 });
      await assert.rejects(reschedule(doc.id, { startAt: at(17), durationMinutes: 30, expectedVersion: doc.version }, admin, after), { status: 409 });
      const done = await changeStatus(doc.id, doc.version, 'completed', admin, after);
      assert.equal(done.status, 'completed'); assert.equal(+done.startAt, +doc.startAt);
      assert.ok(!(await upcomingSessions(now)).upcoming.some(s => s.id === done.id));
    });
    await t.test('membership boundary and gaps are honored; DST transitions do not create invalid sessions', () => {
      const a = new Date('2027-01-01T00:00:00Z'), b = new Date('2027-01-02T00:00:00Z'), c = new Date('2027-01-03T00:00:00Z');
      assert.equal(covered({ periods: [{ startAt: a, expiresAt: b }] }, a, b), true);
      assert.equal(covered({ periods: [{ startAt: a, expiresAt: b }] }, b, c), false);
      assert.equal(covered({ periods: [{ startAt: a, expiresAt: b }, { startAt: new Date(+b + 1), expiresAt: c }] }, a, c), false);
      assert.equal(covered({ periods: [{ startAt: a, expiresAt: b }, { startAt: b, expiresAt: c }] }, a, c), true);
      const profile = { timezone: 'America/New_York', availability: [{ day: 0, start: '00:00', end: '06:00' }] };
      assert.equal(withinHours(profile, new Date('2027-03-14T06:30:00Z'), new Date('2027-03-14T07:30:00Z')), false);
      assert.equal(withinHours(profile, new Date('2027-11-07T05:30:00Z'), new Date('2027-11-07T06:30:00Z')), false);
      assert.equal(withinHours(profile, new Date('2027-11-07T05:00:00Z'), new Date('2027-11-07T05:30:00Z')), true);
      assert.equal(withinHours(profile, new Date('2027-11-07T06:00:00Z'), new Date('2027-11-07T06:30:00Z')), true);
      assert.equal(withinHours({ timezone: 'Asia/Kolkata', availability: [{ day: 1, start: '09:00', end: '10:00' }] }, new Date('2027-01-04T03:30:00Z'), new Date('2027-01-04T04:30:00Z')), true);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
