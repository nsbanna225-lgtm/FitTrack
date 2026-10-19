// Temporary local browser fixture. Uses its own database and drops it on shutdown.
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Payment from '../src/models/Payment.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import { enroll } from '../src/services/membershipService.js';

const database = `fittrack_test_payment_ui_${randomUUID().replaceAll('-', '')}`;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
let server;
async function cleanup() {
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
try {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`);
  await Payment.createIndexes();
  const password = randomBytes(18).toString('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  const member = await User.create({ name: 'Payment Demo Member', email: 'member@payment-ui.example.test', role: 'member', passwordHash });
  const admin = await User.create({ name: 'Payment Demo Admin', email: 'admin@payment-ui.example.test', role: 'admin', passwordHash });
  const plan = await MembershipPlan.create({ name: 'Strength Monthly', nameKey: 'strength monthly', durationDays: 30, priceMinor: 149900, features: [] });
  const startAt = new Date(); startAt.setUTCHours(0, 0, 0, 0);
  await enroll(member.id, { planId: plan.id, startAt }, admin.id);
  const wrapper = express();
  wrapper.use('/api', (req, res) => { req.url = `/api${req.url}`; app(req, res); });
  const dist = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
  wrapper.use(express.static(dist));
  wrapper.get('/{*path}', (_req, res) => res.sendFile(`${dist}/index.html`));
  server = await new Promise((resolve, reject) => { const s = wrapper.listen(5199, '127.0.0.1', () => resolve(s)); s.on('error', reject); });
  console.log(JSON.stringify({ url: 'http://127.0.0.1:5199', memberEmail: member.email, adminEmail: admin.email, password }));
  const stop = async () => { await cleanup(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  // A newline through the tool's stdin provides reliable Windows cleanup.
  process.stdin.resume(); process.stdin.once('data', stop);
} catch (error) { await cleanup(); throw error; }
