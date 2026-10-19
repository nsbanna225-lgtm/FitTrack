import assert from 'node:assert/strict';
import app from '../src/app.js';
import { readEnv } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';

let server;
try {
  await connectDatabase(readEnv().mongoUri);
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/ready`;
  const ready = await fetch(url);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).database, 'connected');
  await disconnectDatabase();
  const unavailable = await fetch(url);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).database, 'disconnected');
  console.log('Database integration passed: connected=200, disconnected=503. No records written.');
} catch {
  console.error('Database integration failed. Check MONGODB_URI and MongoDB availability.');
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase();
}
