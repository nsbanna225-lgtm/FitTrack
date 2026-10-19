import User, { publicUser } from '../src/models/User.js';
import { readEnv } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { createUser } from '../src/services/authService.js';
import { validateRegistration } from '../src/validators/authValidators.js';

try {
  const fields = validateRegistration({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: 'admin',
  }, true);
  await connectDatabase(readEnv().mongoUri);
  await User.createIndexes();
  if (await User.exists({ role: 'admin' })) throw new Error('An admin already exists. Use the admin-only staff endpoint.');
  const user = await createUser(fields);
  console.log(`Initial admin created (${publicUser(user).role}). Log in using the supplied credentials.`);
} catch {
  console.error('Admin bootstrap failed. Check ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, database availability, and whether an admin or email already exists.');
  process.exitCode = 1;
} finally {
  delete process.env.ADMIN_PASSWORD;
  await disconnectDatabase();
}
