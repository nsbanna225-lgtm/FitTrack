import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Attendance from '../src/models/Attendance.js';
import { issueToken } from '../src/services/tokenService.js';
import { checkIn, history, report, percentage, attendanceStats } from '../src/services/attendanceService.js';
import { list } from '../src/validators/attendanceValidators.js';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const db = `fittrack_test_attendance_${randomUUID().replaceAll('-', '')}`;
test('attendance with isolated MongoDB', { timeout: 60000 }, async t => {
  let server;
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${db}`, { serverSelectionTimeoutMS: 5000, autoIndex: false });
    await t.test('legacy attendance is preserved when current unique indexes are built', async () => {
      const legacy = [{ member: new mongoose.Types.ObjectId(), date: new Date() }, { member: new mongoose.Types.ObjectId(), date: new Date() }];
      const inserted = await Attendance.collection.insertMany(legacy);
      await Attendance.createIndexes();
      assert.equal(await Attendance.countDocuments({ _id: { $in: Object.values(inserted.insertedIds) } }), 2);
      const index = (await Attendance.collection.indexes()).find(row => row.name === 'memberId_1_day_1');
      assert.equal(index.unique, true);
      assert.deepEqual(index.partialFilterExpression, { memberId: { $type: 'objectId' }, day: { $type: 'string' } });
    });
    const make = (role, name = `Attendance ${role}`) => User.create({ name, email: `${randomUUID()}@example.test`, role, passwordHash: 'fixture-only' });
    const admin = await make('admin'), trainer = await make('trainer'), member = await make('member'), other = await make('member', 'Zero visits');
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(path = '', { method = 'GET', body, actor = member } = {}) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/attendance${path}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${issueToken(actor)}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json(), headers: response.headers };
    }
    await t.test('guest and trainer access denied; reports restricted to admins', async () => {
      for (const path of ['', '/report']) {
        assert.equal((await request(path, { actor: null })).status, 401);
        assert.equal((await request(path, { actor: trainer })).status, 403);
      }
      assert.equal((await request('/report')).status, 403);
      assert.equal((await request('/check-in', { method: 'POST', actor: trainer, body: {} })).status, 403);
    });
    await t.test('strict dates, range limits, IDs, queries and server-controlled time', async () => {
      for (const path of ['?from=2026-02-30', '?from=2025-01-01&to=2026-02-01', '?from=2026-02-02&to=2026-02-01', '?to=9999-01-01', '?page=0', '?q[x]=1', '?page=1&page=2', `?memberId=${other.id}`]) assert.equal((await request(path)).status, 400, path);
      for (const body of [[], { memberId: other.id }, { checkedInAt: '2026-01-01' }, { day: '2026-01-01' }]) assert.equal((await request('/check-in', { method: 'POST', body })).status, 400);
      for (const body of [{}, { memberId: 'invalid' }, { memberId: { $ne: null } }]) assert.equal((await request('/check-in', { method: 'POST', body, actor: admin })).status, 400);
      assert.throws(() => list({ from: '2025-01-01', to: '2026-01-02' }, 'admin', new Date('2026-01-02')), /366/);
      assert.equal(list({ from: '2024-01-01', to: '2024-12-31' }, 'admin', new Date('2025-01-01')).from, '2024-01-01');
    });
    await t.test('simultaneous member and admin check-ins create exactly one visit', async () => {
      const results = await Promise.all([request('/check-in', { method: 'POST', body: {} }), request('/check-in', { method: 'POST', actor: admin, body: { memberId: member.id } })]);
      assert.deepEqual(results.map(row => row.status).sort(), [201, 409]);
      const created = results.find(row => row.status === 201);
      assert.equal(created.headers.get('cache-control'), 'no-store');
      assert.equal(created.data.attendance.memberId, member.id);
      assert.equal(created.data.attendance.day, new Date(created.data.attendance.checkedInAt).toISOString().slice(0, 10));
      assert.equal(await Attendance.countDocuments({ memberId: member.id }), 1);
    });
    await t.test('members see only their own records and automatically identified check-in', async () => {
      const mine = await request();
      assert.equal(mine.data.records.length, 1); assert.equal(mine.data.summary.checkedInToday, true);
      assert.equal(mine.data.summary.percentage, 100);
      assert.equal((await request('', { actor: other })).data.records.length, 0);
      assert.equal((await request('', { actor: other })).data.summary.percentage, 0);
      assert.equal((await request('?memberId=' + member.id, { actor: other })).status, 400);
      assert.equal((await request('', { actor: admin })).data.records.length, 1);
    });
    await t.test('inactive, archived, missing and non-member targets cannot check in', async () => {
      const post = target => request('/check-in', { method: 'POST', actor: admin, body: { memberId: target } });
      assert.equal((await post(admin.id)).status, 404);
      assert.equal((await post(new mongoose.Types.ObjectId().toString())).status, 404);
      await User.updateOne({ _id: other._id }, { active: false });
      assert.equal((await post(other.id)).status, 404);
      assert.equal((await request('/check-in', { method: 'POST', actor: other, body: {} })).status, 401);
      await User.updateOne({ _id: other._id }, { active: true, archivedAt: new Date() });
      assert.equal((await post(other.id)).status, 404);
      await User.updateOne({ _id: other._id }, { archivedAt: null });
    });
    const clock = new Date('2026-01-03T12:00:00Z');
    await t.test('UTC midnight permits a new day; exact time and attribution retained', async () => {
      await User.collection.updateOne({ _id: member._id }, { $set: { createdAt: new Date('2026-01-01T18:00:00Z') } });
      const a = await checkIn({}, member, new Date('2026-01-01T23:59:59.999Z'));
      const b = await checkIn({ memberId: member.id }, admin, new Date('2026-01-02T00:00:00.000Z'));
      assert.equal(a.day, '2026-01-01'); assert.equal(b.day, '2026-01-02');
      assert.equal(a.source, 'member'); assert.equal(b.source, 'admin');
      await assert.rejects(checkIn({}, member, new Date('2026-01-02T23:59:59Z')), error => error.status === 409);
      assert.equal(String((await Attendance.findById(b.id)).recordedBy), admin.id);
    });
    await t.test('percentage includes registration day and excludes pre-registration and future dates', async () => {
      const result = await history(list({ from: '2025-12-01', to: '2026-01-03' }, 'member', clock), member, clock);
      assert.deepEqual(result.summary, { memberName: member.name, attendedDays: 2, elapsedDays: 3, percentage: 66.7, checkedInToday: false });
      assert.deepEqual(percentage('2026-01-01', '2025-01-01', '2025-12-31', 0), { attendedDays: 0, elapsedDays: 0, percentage: null });
      assert.equal(percentage('2024-01-01', '2024-02-28', '2024-03-01', 2).percentage, 66.7);
      assert.equal((await history(list({ from: '2026-01-02', to: '2026-01-02' }, 'member', clock), member, clock)).records.length, 1);
    });
    await t.test('admin report includes zero visits and retained history, with literal name search', async () => {
      await User.collection.updateOne({ _id: other._id }, { $set: { createdAt: new Date('2026-01-02T00:00:00Z'), active: false } });
      await User.updateOne({ _id: member._id }, { active: false, archivedAt: new Date() });
      const input = list({ from: '2026-01-01', to: '2026-01-03' }, 'admin', clock);
      const data = await report(input);
      assert.equal(data.records.length, 2);
      assert.equal(data.records.find(row => row.id === member.id).percentage, 66.7);
      assert.equal(data.records.find(row => row.id === member.id).active, false);
      assert.equal(data.records.find(row => row.id === other.id).percentage, 0);
      assert.equal((await report({ ...input, q: '.*' })).records.length, 0);
      assert.equal((await report({ ...input, q: 'zero' })).records.length, 1);
      assert.equal((await history({ ...input, memberId: member.id }, admin, clock)).records.length, 2);
      assert.equal((await request('?memberId=' + new mongoose.Types.ObjectId(), { actor: admin })).status, 404);
    });
    await t.test('pagination stable; reports and history do not expose private account fields', async () => {
      for (let day = 4; day <= 15; day++) await Attendance.create({ memberId: member._id, memberName: member.name, day: `2026-01-${String(day).padStart(2, '0')}`, checkedInAt: new Date(`2026-01-${String(day).padStart(2, '0')}T12:00:00Z`), recordedBy: admin._id, source: 'admin' });
      const input = list({ from: '2026-01-01', to: '2026-01-31' }, 'admin', new Date('2026-01-31'));
      const first = await history(input, admin), second = await history({ ...input, page: 2 }, admin);
      assert.equal(first.records.length, 10); assert.equal(second.records.length, 4);
      assert.equal(new Set([...first.records, ...second.records].map(row => row.id)).size, 14);
      assert.deepEqual(Object.keys(first.records[0]).sort(), ['checkedInAt', 'day', 'id', 'memberId', 'memberName', 'source']);
      assert.deepEqual(await attendanceStats(clock), { available: true, today: 0, month: 2 });
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === db) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
