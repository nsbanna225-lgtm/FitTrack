import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let base;
before(async () => {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

test('health endpoint returns the API status', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
  assert.equal(response.headers.get('x-powered-by'), null);
});
test('unknown endpoints return a JSON 404', async () => {
  const response = await fetch(`${base}/api/missing`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).message, 'API endpoint not found.');
});
test('readiness reports 503 when no database is connected', async () => {
  const response = await fetch(`${base}/api/ready`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    status: 'unavailable', service: 'fittrack-api', database: 'disconnected',
  });
});
test('malformed JSON returns a safe error', async () => {
  const response = await fetch(`${base}/api/health`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: 'Invalid request body.' });
});
