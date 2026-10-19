// Isolated browser fixture; no application database writes. Exits after 15 minutes.
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Member from '../src/models/Member.js';
import Progress from '../src/models/Progress.js';
const database = `fittrack_test_progress_ui_${randomUUID().replaceAll('-', '')}`;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
let server, stopping = false;
async function cleanup() {
  if (stopping) return;
  stopping = true;
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('Disposable progress database removed.');
}
try {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`);
  await Progress.createIndexes();
  const password = randomBytes(18).toString('hex'), passwordHash = await bcrypt.hash(password, 12);
  const member = await User.create({ name: 'Progress Demo Member', email: 'member@progress-ui.example.test', role: 'member', passwordHash });
  const trainer = await User.create({ name: 'Progress Demo Trainer', email: 'trainer@progress-ui.example.test', role: 'trainer', passwordHash });
  await User.create({ name: 'Progress Demo Admin', email: 'admin@progress-ui.example.test', role: 'admin', passwordHash });
  await Member.create({ _id: member._id, assignedTrainer: trainer._id });
  for (const [days, weightKg] of [[30, 82], [15, 80]]) await Progress.create({ memberId: member._id, day: new Date(Date.now() - days * 86400000).toISOString().slice(0, 10), weightKg, heightCm: 180, waistCm: 90, notes: 'Disposable chart example.', recordedBy: member._id, updatedBy: member._id });
  const wrapper = express();
  wrapper.use('/api', (req, res) => { req.url = `/api${req.url}`; app(req, res); });
  const dist = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
  wrapper.use(express.static(dist));
  wrapper.get('/{*path}', (_req, res) => res.sendFile(`${dist}/index.html`));
  server = await new Promise((resolve, reject) => { const s = wrapper.listen(5200, '127.0.0.1', () => resolve(s)); s.on('error', reject); });
  console.log(JSON.stringify({ url: 'http://127.0.0.1:5200', password }));
  const stop = async () => { await cleanup(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  process.stdin.resume(); process.stdin.once('data', stop);
  setTimeout(stop, 15 * 60 * 1000).unref();
} catch (error) { await cleanup(); throw error; }
