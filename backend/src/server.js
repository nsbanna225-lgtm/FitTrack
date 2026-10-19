import Notification from './models/Notification.js';
import PushSubscription from './models/PushSubscription.js';
import Progress from './models/Progress.js';
import User from './models/User.js';
import Payment from './models/Payment.js';
import Attendance from './models/Attendance.js';
import MembershipPlan from './models/MembershipPlan.js';
import Session from './models/Session.js';
import Exercise from './models/Exercise.js';
import WorkoutPlan from './models/WorkoutPlan.js';
import WorkoutAssignment from './models/WorkoutAssignment.js';
import app from './app.js';
import { readEnv, readAuthEnv, readPushEnv } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { configurePush } from './services/pushService.js';
import { syncSubscribedUsers } from './services/notificationService.js';

let server;
let pushSweep;
let shuttingDown = false;
let startupStage = 'environment validation';

function logError(message, error) {
  // Retain diagnostic stacks/codes without exposing connection credentials or JWT secrets.
  let details = '';
  for (let current = error; current; current = current.cause) {
    details += `${current.stack || current.message || current}\n`;
    if (current.code !== undefined) details += `Code: ${current.code}\n`;
  }
  details = details.replace(/mongodb(?:\+srv)?:\/\/[^\s'"<>]+/gi, '[redacted MongoDB URI]');
  if (process.env.JWT_SECRET) details = details.replaceAll(process.env.JWT_SECRET, '[redacted JWT secret]');
  console.error(message, details);
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  try {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    clearInterval(pushSweep);
    await disconnectDatabase();
    process.exit(code);
  } catch (error) {
    logError('FitTrack shutdown failed.', error);
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { void shutdown(); });
}

try {
  const env = readEnv();
  readAuthEnv();
  const pushEnv = readPushEnv();
  configurePush(pushEnv);
  startupStage = 'MongoDB connection';
  await connectDatabase(env.mongoUri);
  for (const model of [User, Attendance, Payment, Progress, Notification, PushSubscription, MembershipPlan, Session, Exercise, WorkoutPlan, WorkoutAssignment]) {
    startupStage = `${model.modelName} indexes`;
    await model.createIndexes();
  }
  if (!shuttingDown) {
    console.log('MongoDB connected.');
    startupStage = 'HTTP listener';
    await new Promise((resolve, reject) => {
      server = app.listen(env.port, env.host, resolve);
      server.once('error', reject);
    });
    console.log(`FitTrack API running at http://${env.host}:${env.port}`);
    if (pushEnv.publicKey) {
      pushSweep = setInterval(() => { void syncSubscribedUsers().catch(error => logError('Push notification sweep failed.', error)); }, 60000);
      pushSweep.unref();
      void syncSubscribedUsers().catch(error => logError('Push notification sweep failed.', error));
    }
    server.on('error', (error) => {
      logError('HTTP server error.', error);
      void shutdown(1);
    });
  }
}  catch (error) {
  logError(`FitTrack startup failed. Stage: ${startupStage}.`, error);

  await shutdown(1);
}



