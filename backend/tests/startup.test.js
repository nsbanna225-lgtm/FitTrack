import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backend = fileURLToPath(new URL('../', import.meta.url));

test('startup fails safely when MongoDB cannot be reached', { timeout: 35000 }, async () => {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: backend,
    env: { ...process.env, JWT_SECRET: randomBytes(48).toString('hex'), MONGODB_URI: 'mongodb://testuser:do-not-print@127.0.0.1:1/fittrack', PORT: '5099' },
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  // Include cold Node/module loading on slower Windows hosts before the driver timeout.
  const deadline = setTimeout(() => child.kill(), 30000);
  try {
    const code = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', resolve);
    });
    assert.equal(code, 1);
    assert.match(output, /startup failed/);
    assert.match(output, /Stage: MongoDB connection/);
    assert.match(output, /ECONNREFUSED/);
    assert.doesNotMatch(output, /do-not-print|testuser|API running/);
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null) child.kill();
  }
});

