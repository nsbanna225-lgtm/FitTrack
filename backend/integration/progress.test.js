import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Member from '../src/models/Member.js';
import Progress from '../src/models/Progress.js';
import WorkoutAssignment from '../src/models/WorkoutAssignment.js';
import { issueToken } from '../src/services/tokenService.js';
import { bmi } from '../src/services/progressService.js';
import { entry, list } from '../src/validators/progressValidators.js';

process.env.JWT_SECRET = randomBytes(48).toString('hex');
const database = `fittrack_test_progress_${randomUUID().replaceAll('-', '')}`;
test('fitness progress with isolated MongoDB', { timeout: 60000 }, async t => {
  let server;
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, { serverSelectionTimeoutMS: 5000, autoIndex: false });
    await Progress.createIndexes();
    const make = role => User.create({ name: `Progress ${role}`, email: `${randomUUID()}@example.test`, role, passwordHash: 'fixture-only' });
    const member = await make('member'), other = await make('member'), admin = await make('admin'), trainer = await make('trainer'), stranger = await make('trainer');
    await Member.create({ _id: member._id, assignedTrainer: trainer._id });
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request({ actor = member, target = member.id, suffix = '', method = 'GET', body } = {}) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/progress/members/${target}${suffix}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${issueToken(actor)}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json(), headers: response.headers };
    }
    const base = { day: '2026-01-01', weightKg: 80, heightCm: 200, waistCm: 90, notes: 'First measurement' };
    const period = '?from=2026-01-01&to=2026-01-31';
    let record;
    await t.test('guests denied and members cannot read or write other members', async () => {
      assert.equal((await request({ actor: null })).status, 401);
      assert.equal((await request({ target: other.id })).status, 404);
      assert.equal((await request({ target: other.id, method: 'POST', body: base })).status, 404);
      assert.equal((await request({ actor: stranger })).status, 404);
      assert.equal((await request({ actor: trainer, method: 'POST', body: base })).status, 403);
      assert.equal((await request({ target: 'bad' })).status, 400);
      assert.equal((await request({ target: admin.id, actor: admin })).status, 404);
    });
    await t.test('strict fields, calendar dates, measurement ranges, precision, and query validation', async () => {
      for (const body of [[], {}, { ...base, bmi: 1 }, { ...base, memberId: other.id }, { ...base, weightKg: '80' }, { ...base, heightCm: 0 }, { ...base, weightKg: null }, { ...base, waistCm: -1 }, { ...base, chestCm: 300.1 }, { ...base, hipsCm: 2.22 }, { ...base, day: '2026-02-30' }, { ...base, day: '9999-01-01' }, { ...base, day: '1899-01-01' }, { ...base, notes: {} }, { ...base, notes: 'x'.repeat(2001) }]) {
        assert.equal((await request({ method: 'POST', body })).status, 400, JSON.stringify(body).slice(0, 100));
      }
      for (const suffix of ['?page=0', '?page=1&page=2', '?from=2026-02-30', '?memberId=x', '?q=x', '?from=2026-02-01&to=2026-01-01', '?to=9999-01-01', '?from=2024-01-01&to=2026-01-01', '?from[x]=1']) assert.equal((await request({ suffix })).status, 400, suffix);
      assert.equal(entry({ day: '2024-02-29', weightKg: 1, heightCm: 30, waistCm: 300 }, false, new Date('2024-02-29T00:00:00Z')).weightKg, 1);
      assert.throws(() => entry({ ...base, day: '2024-03-01' }, false, new Date('2024-02-29T23:59:59Z')));
      assert.equal(list({ from: '2024-01-01', to: '2024-12-31' }, new Date('2025-01-01')).from, '2024-01-01');
      assert.equal(bmi(80, 200), 20); assert.equal(bmi(70, 175), 22.9); assert.equal(bmi(80, null), null);
    });
    await t.test('concurrent daily creation stores one entry, calculated BMI, and private response', async () => {
      const results = await Promise.all([request({ method: 'POST', body: base }), request({ method: 'POST', actor: admin, body: base })]);
      assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
      record = results.find(r => r.status === 201).data.progress;
      assert.equal(record.bmi, 20); assert.equal(record.version, 1); assert.equal(record.chestCm, null);
      assert.equal(await Progress.countDocuments(), 1);
      const response = await request({ suffix: period });
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.doesNotMatch(JSON.stringify(response.data), /passwordHash|tokenVersion|recordedBy|updatedBy|email/);
      assert.equal(response.data.summary.weightChangeKg, null);
    });
    await t.test('version checks prevent lost edits; owner and duplicate-date boundaries enforced', async () => {
      const edit = { ...base, weightKg: 79, expectedVersion: 1 };
      const results = await Promise.all([request({ method: 'PUT', suffix: `/${record.id}`, body: edit }), request({ actor: admin, method: 'PUT', suffix: `/${record.id}`, body: edit })]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
      assert.equal((await request({ method: 'PUT', suffix: `/${record.id}`, body: edit })).status, 409);
      assert.equal((await request({ method: 'PUT', suffix: `/${record.id}`, body: base })).status, 400);
      assert.equal((await request({ actor: other, target: other.id, method: 'PUT', suffix: `/${record.id}`, body: edit })).status, 404);
      assert.equal((await request({ actor: trainer, method: 'PUT', suffix: `/${record.id}`, body: edit })).status, 403);
      const second = await request({ method: 'POST', body: { ...base, day: '2026-01-02', heightCm: null } });
      assert.equal(second.data.progress.bmi, null);
      assert.equal((await request({ method: 'PUT', suffix: `/${record.id}`, body: { ...base, day: '2026-01-02', expectedVersion: 2 } })).status, 409);
      assert.equal((await request({ suffix: period })).data.records.find(r => r.id === record.id).weightKg, 79);
    });
    await t.test('trainer access follows current assignment and disappears after reassignment', async () => {
      assert.equal((await request({ actor: trainer, suffix: period })).status, 200);
      assert.equal((await request({ actor: trainer, suffix: period })).data.member.editable, false);
      await Member.updateOne({ _id: member._id }, { assignedTrainer: stranger._id });
      assert.equal((await request({ actor: trainer, suffix: period })).status, 404);
      assert.equal((await request({ actor: stranger, suffix: period })).status, 200);
    });
    await t.test('full-period trends and summary stay independent of pagination with historical BMI', async () => {
      for (let day = 3; day <= 12; day++) await request({ method: 'POST', body: { ...base, day: `2026-01-${String(day).padStart(2, '0')}`, weightKg: 80 + day, heightCm: 180 } });
      const first = (await request({ suffix: period })).data, second = (await request({ suffix: `${period}&page=2` })).data;
      assert.equal(first.records.length, 10); assert.equal(second.records.length, 2);
      assert.equal(first.trend.length, 12); assert.deepEqual(first.trend, second.trend);
      assert.equal(first.summary.weightChangeKg, 13); assert.equal(first.summary.latest.weightKg, 92);
      assert.equal(first.trend[0].bmi, 19.8); assert.equal(first.trend[1].bmi, null);
      assert.equal(first.records[0].day, '2026-01-12');
      assert.equal(new Set([...first.records, ...second.records].map(r => r.id)).size, 12);
      const empty = (await request({ suffix: '?from=2025-01-01&to=2025-01-31' })).data;
      assert.equal(empty.trend.length, 0); assert.equal(empty.summary.latest, null);
      assert.equal((await request({ suffix: `${period}&page=9` })).data.summary.latest.weightKg, 92);
    });
    await t.test('workout summary includes current completion and archived assignments in assignment-date range', async () => {
      // Persist exact historical timestamps to exercise the aggregate's UTC boundaries.
      await WorkoutAssignment.collection.insertMany([
        { memberId: member._id, createdAt: new Date('2026-01-01T00:00:00Z'), itemCount: 3, completedCount: 2, archived: false },
        { memberId: member._id, createdAt: new Date('2026-01-31T23:59:59.999Z'), itemCount: 2, completedCount: 2, archived: true },
        { memberId: member._id, createdAt: new Date('2026-02-01T00:00:00Z'), itemCount: 10, completedCount: 10 },
        { memberId: other._id, createdAt: new Date('2026-01-15T12:00:00Z'), itemCount: 10, completedCount: 10 },
      ]);
      assert.deepEqual((await request({ suffix: period })).data.summary.workout, { assignments: 2, completed: 4, items: 5, percentage: 80 });
      assert.equal((await request({ suffix: '?from=2025-01-01&to=2025-01-31' })).data.summary.workout.percentage, null);
    });
    await t.test('inactive or archived accounts retain read-only staff history and cannot be edited', async () => {
      await User.updateOne({ _id: member._id }, { active: false });
      assert.equal((await request()).status, 401);
      const read = await request({ actor: admin, suffix: period });
      assert.equal(read.status, 200); assert.equal(read.data.member.editable, false); assert.equal(read.data.pagination.total, 12);
      assert.equal((await request({ actor: admin, method: 'POST', body: { ...base, day: '2026-01-15' } })).status, 409);
      await User.updateOne({ _id: member._id }, { active: true, archivedAt: new Date() });
      assert.equal((await request({ actor: admin, method: 'PUT', suffix: `/${record.id}`, body: { ...base, expectedVersion: 2 } })).status, 409);
      assert.equal((await request({ actor: admin, suffix: period })).data.pagination.total, 12);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
