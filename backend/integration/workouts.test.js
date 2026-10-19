import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Member from '../src/models/Member.js';
import Exercise from '../src/models/Exercise.js';
import WorkoutPlan from '../src/models/WorkoutPlan.js';
import WorkoutAssignment from '../src/models/WorkoutAssignment.js';
import { issueToken } from '../src/services/tokenService.js';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const database = `fittrack_test_workouts_${randomUUID().replaceAll('-', '')}`;
test('workout management with isolated MongoDB', { timeout: 60000 }, async t => {
  let server;
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, { serverSelectionTimeoutMS: 5000, autoIndex: false });
    await Promise.all([Exercise.createIndexes(), WorkoutPlan.createIndexes(), WorkoutAssignment.createIndexes()]);
    const make = role => User.create({ name: `Workout ${role}`, email: `${randomUUID()}@example.test`, role, passwordHash: 'fixture-only' });
    const admin = await make('admin'), trainer = await make('trainer'), otherTrainer = await make('trainer'), member = await make('member'), outsider = await make('member');
    await Member.create({ _id: member._id, assignedTrainer: trainer._id });
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    async function request(path, { method = 'GET', body, actor = trainer } = {}) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/workouts${path}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${issueToken(actor)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json(), headers: response.headers };
    }
    const exerciseBody = { name: 'Goblet squat', instructions: 'Keep your movement controlled.' };
    let exercise, plan, assignment;
    const planBody = () => ({ name: 'Foundation cycle', instructions: 'Complete each day in order.', items: [
      { exerciseId: exercise.id, day: 1, sets: 3, reps: 10, durationSeconds: null, restSeconds: 60, instructions: 'Use a comfortable load.' },
      { exerciseId: exercise.id, day: 3, sets: 2, reps: null, durationSeconds: 30, restSeconds: 45, instructions: 'Timed variation.' },
    ] });
    await t.test('guests, members, injection and malformed IDs are rejected on staff endpoints', async () => {
      for (const path of ['/exercises','/plans','/members','/assignments']) assert.equal((await request(path, { actor: null })).status, 401);
      for (const path of ['/exercises','/plans','/members']) assert.equal((await request(path, { actor: member })).status, 403);
      assert.equal((await request('/exercises', { method: 'POST', actor: member, body: exerciseBody })).status, 403);
      for (const body of [{ ...exerciseBody, ownerId: admin.id }, { ...exerciseBody, name: { $ne: null } }, { name: 'x' }, []]) assert.equal((await request('/exercises', { method: 'POST', body })).status, 400);
      for (const path of ['/plans?page=0','/plans?q[x]=1','/assignments?memberId=invalid','/assignments/nope']) assert.equal((await request(path)).status, 400);
      assert.equal((await request('/assignments?memberId=' + outsider.id, { actor: member })).status, 400);
      assert.equal((await request('/exercises?ownerId=' + trainer.id)).status, 400);
    });
    await t.test('exercise library is owner scoped, searchable and version checked', async () => {
      const created = await request('/exercises', { method: 'POST', body: exerciseBody });
      assert.equal(created.status, 201); assert.equal(created.headers.get('cache-control'), 'no-store'); exercise = created.data.exercise;
      assert.equal((await request('/exercises', { actor: otherTrainer })).data.records.length, 0);
      assert.equal((await request('/exercises?q=.*')).data.records.length, 0);
      assert.equal((await request('/exercises?q=GOBLET')).data.records.length, 1);
      assert.equal((await request(`/exercises/${exercise.id}`, { method: 'PUT', actor: otherTrainer, body: { ...exerciseBody, active: true, expectedVersion: 1 } })).status, 404);
      const results = await Promise.all([1,2].map(() => request(`/exercises/${exercise.id}`, { method: 'PUT', body: { ...exerciseBody, active: true, expectedVersion: 1 } })));
      assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
      exercise = results.find(r => r.status === 200).data.exercise;
    });
    await t.test('plan fields validate limits, exercise ownership, repetitions and timed exercises', async () => {
      for (const patch of [{ sets: 0 }, { sets: 2.2 }, { day: 8 }, { reps: null, durationSeconds: null }, { reps: '10' }, { durationSeconds: 7201 }, { restSeconds: -1 }, { completed: true }]) {
        const body = planBody(); body.items[0] = { ...body.items[0], ...patch };
        assert.equal((await request('/plans', { method: 'POST', body })).status, 400);
      }
      assert.equal((await request('/plans', { method: 'POST', body: { ...planBody(), items: [] } })).status, 400);
      assert.equal((await request('/plans', { method: 'POST', body: { ...planBody(), items: Array(51).fill(planBody().items[0]) } })).status, 400);
      assert.equal((await request('/plans', { method: 'POST', actor: otherTrainer, body: planBody() })).status, 409);
      const result = await request('/plans', { method: 'POST', body: planBody() });
      assert.equal(result.status, 201); plan = result.data.plan;
      assert.equal(plan.items[0].name, exerciseBody.name); assert.equal(plan.items[1].durationSeconds, 30);
      assert.equal((await request('/plans', { actor: otherTrainer })).data.records.length, 0);
      assert.equal((await request(`/plans/${plan.id}`, { actor: otherTrainer, method: 'PUT', body: { ...planBody(), active: true, expectedVersion: 1 } })).status, 404);
    });
    await t.test('member options are assigned active accounts with no private fields', async () => {
      const result = await request('/members');
      assert.equal(result.data.records.length, 1); assert.equal(result.data.records[0].id, member.id);
      assert.deepEqual(Object.keys(result.data.records[0]).sort(), ['id','name']);
      assert.equal((await request('/members', { actor: otherTrainer })).data.records.length, 0);
      assert.equal((await request('/members', { actor: admin })).data.records.length, 2);
      assert.equal((await request('/members?q=.*')).data.records.length, 0);
      await User.updateOne({ _id: member._id }, { active: false });
      assert.equal((await request('/members')).data.records.length, 0);
      assert.equal((await request(`/plans/${plan.id}/assign`, { method: 'POST', body: { memberId: member.id, expectedVersion: 1 } })).status, 409);
      await User.updateOne({ _id: member._id }, { active: true });
    });
    await t.test('assignment enforces ownership, current version, member eligibility and concurrent uniqueness', async () => {
      const path = `/plans/${plan.id}/assign`, body = { memberId: member.id, expectedVersion: 1 };
      assert.equal((await request(path, { method: 'POST', actor: member, body })).status, 403);
      assert.equal((await request(path, { method: 'POST', actor: otherTrainer, body })).status, 404);
      assert.equal((await request(path, { method: 'POST', body: { ...body, memberId: outsider.id } })).status, 404);
      assert.equal((await request(path, { method: 'POST', body: { ...body, expectedVersion: 9 } })).status, 409);
      const results = await Promise.all([1,2].map(() => request(path, { method: 'POST', body })));
      assert.deepEqual(results.map(r => r.status).sort(), [201,409]); assignment = results.find(r => r.status === 201).data.assignment;
      assert.equal(await WorkoutAssignment.countDocuments(), 1); assert.equal(assignment.completedCount, 0);
    });
    await t.test('assignment snapshots preserve original plan and library instructions through edits', async () => {
      const edited = await request(`/exercises/${exercise.id}`, { method: 'PUT', body: { ...exerciseBody, name: 'Updated squat', active: true, expectedVersion: exercise.version } });
      assert.equal(edited.status, 200); exercise = edited.data.exercise;
      const updated = await request(`/plans/${plan.id}`, { method: 'PUT', body: { ...planBody(), name: 'Revised foundation', active: true, expectedVersion: plan.version } });
      assert.equal(updated.status, 200); plan = updated.data.plan;
      assert.equal(plan.items[0].name, 'Updated squat');
      const saved = (await request(`/assignments/${assignment.id}`, { actor: member })).data.assignment;
      assert.equal(saved.name, 'Foundation cycle'); assert.equal(saved.items[0].name, 'Goblet squat'); assert.equal(saved.planVersion, 1);
    });
    await t.test('assignment reads, filters and completion are scoped to the correct users', async () => {
      assert.equal((await request('/assignments', { actor: member })).data.records.length, 1);
      assert.equal((await request('/assignments', { actor: outsider })).data.records.length, 0);
      assert.equal((await request('/assignments', { actor: otherTrainer })).data.records.length, 0);
      assert.equal((await request('/assignments?memberId=' + outsider.id)).data.records.length, 0);
      assert.equal((await request(`/assignments/${assignment.id}`, { actor: outsider })).status, 404);
      const path = `/assignments/${assignment.id}/completion`, body = { expectedVersion: 1, itemIndex: 0, completed: true };
      assert.equal((await request(path, { method: 'PATCH', body })).status, 403);
      assert.equal((await request(path, { method: 'PATCH', actor: admin, body })).status, 403);
      assert.equal((await request(path, { method: 'PATCH', actor: outsider, body })).status, 404);
      for (const patch of [{ completed: 'true' }, { itemIndex: 2 }, { memberId: outsider.id }, { expectedVersion: 0 }]) assert.equal((await request(path, { method: 'PATCH', actor: member, body: { ...body, ...patch } })).status, 400);
      const results = await Promise.all([0,1].map(itemIndex => request(path, { method: 'PATCH', actor: member, body: { ...body, itemIndex } })));
      assert.deepEqual(results.map(r => r.status).sort(), [200,409]); assignment = results.find(r => r.status === 200).data.assignment;
      assert.equal(assignment.completedCount, 1);
      const index = assignment.completed.findIndex(value => !value);
      assignment = (await request(path, { method: 'PATCH', actor: member, body: { ...body, itemIndex: index, expectedVersion: assignment.version } })).data.assignment;
      assert.equal(assignment.status, 'completed'); assert.equal(assignment.completedCount, 2);
      assert.equal((await request('/assignments?status=active', { actor: member })).data.records.length, 0);
      assert.equal((await request('/assignments?status=completed', { actor: member })).data.records.length, 1);
      assignment = (await request(path, { method: 'PATCH', actor: member, body: { ...body, completed: false, expectedVersion: assignment.version } })).data.assignment;
      assert.equal(assignment.status, 'active'); assert.equal(assignment.completedCount, 1);
    });
    await t.test('trainer reassignment revokes previous trainer access and grants current trainer oversight', async () => {
      await Member.updateOne({ _id: member._id }, { assignedTrainer: otherTrainer._id });
      assert.equal((await request(`/assignments/${assignment.id}`)).status, 404);
      assert.equal((await request(`/assignments/${assignment.id}/archive`, { method: 'POST', body: { expectedVersion: assignment.version } })).status, 404);
      assert.equal((await request(`/assignments/${assignment.id}`, { actor: otherTrainer })).status, 200);
      assert.equal((await request(`/assignments/${assignment.id}`, { actor: member })).status, 200);
      await Member.updateOne({ _id: member._id }, { assignedTrainer: trainer._id });
    });
    await t.test('archive preserves progress, blocks member changes and allows a new cycle', async () => {
      const path = `/assignments/${assignment.id}/archive`;
      assert.equal((await request(path, { actor: member, method: 'POST', body: { expectedVersion: assignment.version } })).status, 403);
      const results = await Promise.all([1,2].map(() => request(path, { method: 'POST', body: { expectedVersion: assignment.version } })));
      assert.deepEqual(results.map(r => r.status).sort(), [200,409]); assignment = results.find(r => r.status === 200).data.assignment;
      assert.equal(assignment.status, 'archived'); assert.equal(assignment.completedCount, 1);
      assert.equal((await request(`/assignments/${assignment.id}/completion`, { method: 'PATCH', actor: member, body: { expectedVersion: assignment.version, itemIndex: 0, completed: true } })).status, 409);
      assert.equal((await request('/assignments?status=archived', { actor: member })).data.records.length, 1);
      const next = await request(`/plans/${plan.id}/assign`, { method: 'POST', body: { memberId: member.id, expectedVersion: plan.version } });
      assert.equal(next.status, 201); assert.equal(next.data.assignment.completedCount, 0); assert.equal(next.data.assignment.name, 'Revised foundation');
    });
    await t.test('inactive exercises and plans retain history but cannot be newly selected or assigned', async () => {
      await request(`/exercises/${exercise.id}`, { method: 'PUT', body: { ...exerciseBody, active: false, expectedVersion: exercise.version } });
      assert.equal((await request('/plans', { method: 'POST', body: planBody() })).status, 409);
      const result = await request(`/plans/${plan.id}`, { method: 'PUT', body: { ...planBody(), active: false, expectedVersion: plan.version } });
      assert.equal(result.status, 200); plan = result.data.plan;
      assert.equal((await request(`/plans/${plan.id}/assign`, { method: 'POST', actor: admin, body: { memberId: outsider.id, expectedVersion: plan.version } })).status, 409);
      assert.equal((await request(`/assignments/${assignment.id}`, { actor: member })).status, 200);
    });
    await t.test('admin oversight and pagination do not disclose account credentials or change ownership', async () => {
      assert.equal((await request('/plans?status=all', { actor: admin })).data.records.length, 1);
      assert.equal((await request('/exercises?status=all&ownerId=' + otherTrainer.id, { actor: admin })).data.records.length, 0);
      await Exercise.insertMany(Array.from({ length: 12 }, (_, i) => ({ ownerId: trainer._id, name: `Movement ${i}`, instructions: '' })));
      const first = (await request('/exercises')).data, second = (await request('/exercises?page=2')).data;
      assert.equal(first.records.length, 10); assert.equal(second.records.length, 2); assert.equal(first.pagination.total, 12);
      assert.equal(new Set([...first.records,...second.records].map(r => r.id)).size, 12);
      const adminPlan = await request('/plans', { actor: admin, method: 'POST', body: planBody() });
      assert.equal(adminPlan.status, 409);
      assert.equal((await WorkoutPlan.findById(plan.id)).ownerId.toString(), trainer.id);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === database && database.startsWith('fittrack_test_')) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
