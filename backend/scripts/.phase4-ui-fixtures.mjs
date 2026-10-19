import { writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import User from '../src/models/User.js';
import { createUser } from '../src/services/authService.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { readEnv } from '../src/config/env.js';

const manifestPath = join(tmpdir(), 'fittrack-phase4-ui-fixtures.json');
try {
  await connectDatabase(readEnv().mongoUri);
  if (process.argv[2] === 'cleanup') {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (!/^[a-f0-9-]{36}$/.test(manifest.run)) throw new Error('Invalid test run');
    const emails = ['member', 'admin', 'trainer'].map((role) => `fittrack-ui-${role}-${manifest.run}@example.test`);
    const result = await User.deleteMany({ email: { $in: emails } });
    console.log(`Removed ${result.deletedCount} temporary UI test accounts.`);
    await unlink(manifestPath);
  } else {
    const run = randomUUID();
    const password = 'Temporary-UI-test-2026!';
    const emails = Object.fromEntries(['member', 'admin', 'trainer'].map((role) => [role, `fittrack-ui-${role}-${run}@example.test`]));
    await writeFile(manifestPath, JSON.stringify({ run }), { flag: 'wx' });
    for (const role of ['admin', 'trainer']) await createUser({ name: `UI Test ${role}`, email: emails[role], password, role });
    console.log(JSON.stringify({ emails, password }));
  }
} finally { await disconnectDatabase(); }
