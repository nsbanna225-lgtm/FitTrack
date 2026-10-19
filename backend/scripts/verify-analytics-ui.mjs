// Disposable browser fixture with an identity-specific shutdown file and 15-minute timeout.
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { existsSync, unlinkSync } from 'node:fs';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Attendance from '../src/models/Attendance.js';
import Session from '../src/models/Session.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import Payment from '../src/models/Payment.js';
import WorkoutAssignment from '../src/models/WorkoutAssignment.js';
import { enroll } from '../src/services/membershipService.js';
const runId = randomUUID().replaceAll('-', '');
const database = `fittrack_test_analytics_ui_${runId}`;
const stopFile = fileURLToPath(new URL(`.analytics-ui-stop-${runId}`, import.meta.url));
process.env.JWT_SECRET = randomBytes(48).toString('hex');
let server, stopping = false, stopTimer;
async function cleanup() {
  if (stopping) return;
  stopping = true; clearInterval(stopTimer);
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (existsSync(stopFile)) unlinkSync(stopFile);
  console.log('Disposable analytics database removed.');
}
try {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`);
  await Promise.all([User.init(), Attendance.init(), Payment.init(), Session.init()]);
  const password = randomBytes(18).toString('hex'), passwordHash = await bcrypt.hash(password, 12);
  const member = await User.create({ name: 'Analytics Demo Member', email: 'member@analytics-ui.example.test', role: 'member', passwordHash });
  const trainer = await User.create({ name: 'Analytics Demo Trainer', email: 'trainer@analytics-ui.example.test', role: 'trainer', passwordHash });
  const admin = await User.create({ name: 'Analytics Demo Admin', email: 'admin@analytics-ui.example.test', role: 'admin', passwordHash });
  const startAt = new Date(Date.now() + 3600000);
  await Session.create({ memberId: member._id, trainerId: trainer._id, memberName: member.name, trainerName: trainer.name, timezone: 'Asia/Kolkata', startAt, endAt: new Date(+startAt + 3600000), createdBy: member._id, updatedBy: member._id });
  const plan = await MembershipPlan.create({ name: 'Strength Monthly', nameKey: 'strength monthly', durationDays: 30, priceMinor: 149900, features: [] });
  const historical = new Date(Date.now() - 27 * 86400000); historical.setUTCHours(0, 0, 0, 0);
  const coverage = await enroll(member.id, { planId: plan.id, startAt: historical }, admin.id, historical);
  const period = coverage.membership.latest;
  await Payment.create({ memberId: member._id, periodId: period.id, memberName: member.name, planName: plan.name, startAt: period.startAt, expiresAt: period.expiresAt, amountMinor: plan.priceMinor, events: [{ status: 'pending', at: new Date(), actorId: member._id }] });
  await WorkoutAssignment.create({ planId: new mongoose.Types.ObjectId(), planVersion: 1, memberId: member._id, memberName: member.name, trainerName: trainer.name, assignedBy: trainer._id, name: 'Strength & mobility', items: [{ exerciseId: new mongoose.Types.ObjectId(), name: 'Bodyweight squat', day: 1, sets: 3, reps: 10, restSeconds: 60 }], itemCount: 1, completed: [false] });
  for (let i = 1; i <= 9; i++) {
    const at = new Date(Date.now() - i * 8 * 86400000);
    await User.collection.insertOne({ name: `Demo member ${i}`, email: `demo${i}@analytics-ui.example.test`, role: 'member', active: true, createdAt: at });
    await Attendance.create({ memberId: member._id, memberName: member.name, day: at.toISOString().slice(0,10), checkedInAt: at, recordedBy: admin._id, source: 'admin' });
    await Payment.create({ memberId: member._id, periodId: new mongoose.Types.ObjectId(), memberName: member.name, planName: plan.name, startAt: at, expiresAt: new Date(+at + 30*86400000), amountMinor: 100000 + i * 5000, status: 'paid', paidAt: at });
    await Session.create({ memberId: member._id, trainerId: trainer._id, memberName: member.name, trainerName: trainer.name, timezone: 'UTC', startAt: at, endAt: new Date(+at + 3600000), status: i % 3 ? 'completed' : 'cancelled', createdBy: admin._id, updatedBy: admin._id });
  }
  const wrapper = express();
  wrapper.use('/api', (req, res) => { req.url = `/api${req.url}`; app(req, res); });
  const dist = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
  wrapper.use(express.static(dist));
  wrapper.get('/{*path}', (_req, res) => res.sendFile(`${dist}/index.html`));
  server = await new Promise((resolve, reject) => { const s = wrapper.listen(5202, '127.0.0.1', () => resolve(s)); s.on('error', reject); });
  console.log(JSON.stringify({ url: 'http://127.0.0.1:5202', password, stopFile }));
  const stop = async () => { await cleanup(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  process.stdin.resume(); process.stdin.once('data', stop);
  stopTimer = setInterval(() => { if (existsSync(stopFile)) void stop(); }, 500);
  setTimeout(stop, 15 * 60 * 1000).unref();
} catch (error) { await cleanup(); throw error; }

