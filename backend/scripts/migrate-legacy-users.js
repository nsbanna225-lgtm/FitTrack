// Dry-run by default. Copies existing bcrypt hashes; never resets passwords or roles.
import mongoose from 'mongoose';
import { readEnv } from '../src/config/env.js';

const apply = process.argv.includes('--apply');
try {
  await mongoose.connect(readEnv().mongoUri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
  const users = mongoose.connection.db.collection('users');
  const legacy = await users.find({ passwordHash: { $exists: false } }).toArray();
  let eligible = 0;
  let updated = 0;
  for (const user of legacy) {
    if (typeof user.password !== 'string' || !/^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password)) {
      console.warn(`Skipped ${user._id}: no supported legacy bcrypt hash.`);
      continue;
    }
    // Do not infer account status from an unfamiliar legacy status field.
    if (['isActive', 'disabled', 'status'].some(key => Object.hasOwn(user, key))) {
      console.warn(`Skipped ${user._id}: legacy account status requires review.`);
      continue;
    }
    eligible++;
    const fields = { passwordHash: user.password };
    for (const [key, value] of Object.entries({ active: true, tokenVersion: 0, archivedAt: null })) {
      if (!Object.hasOwn(user, key)) fields[key] = value;
    }
    if (apply) {
      const result = await users.updateOne({ _id: user._id, passwordHash: { $exists: false }, password: user.password }, { $set: fields });
      updated += result.modifiedCount;
    }
  }
  console.log(JSON.stringify({ database: mongoose.connection.name, mode: apply ? 'apply' : 'dry-run', eligible, updated }));
} finally {
  await mongoose.disconnect();
}
