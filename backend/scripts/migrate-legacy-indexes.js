// Explicit one-time compatibility repair, never invoked by application startup.
// Dry-run by default. Preserve legacy uniqueness before removing each blocking index.
import mongoose from 'mongoose';
import { readEnv } from '../src/config/env.js';

const apply = process.argv.includes('--apply');
try {
  await mongoose.connect(readEnv().mongoUri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  for (const [collection, field] of [['members', 'memberId'], ['trainers', 'email'], ['memberships', 'name'], ['payments', 'paymentId']]) {
    if (!await db.listCollections({ name: collection }).hasNext()) continue;
    const records = db.collection(collection);
    const name = `${field}_1`;
    const index = (await records.indexes()).find(row => row.name === name);
    if (!index || !index.unique || index.partialFilterExpression) continue;
    if (JSON.stringify(index.key) !== JSON.stringify({ [field]: 1 })) throw new Error(`Unexpected index definition: ${collection}.${name}`);
    const types = await records.aggregate([{ $group: { _id: { $type: `$${field}` } } }]).toArray();
    if (types.some(row => !['string', 'missing', 'null'].includes(row._id))) throw new Error(`Review legacy value types before changing ${collection}.${name}`);
    console.log(`${apply ? 'Repair' : 'Would repair'} ${collection}.${name}`);
    if (apply) {
      await records.createIndex({ [field]: 1 }, {
        name: `${name}_legacy_valid`, unique: true,
        partialFilterExpression: { [field]: { $type: 'string' } },
        ...(index.collation ? { collation: index.collation } : {}),
      });
      await records.dropIndex(name);
    }
  }
  // Older attendance collections may have the auto-generated compound unique
  // index without the current partial filter. Recreate it with the filter so
  // startup can safely create the current model index.
  const attendance = db.collection('attendances');
  if (await db.listCollections({ name: 'attendances' }).hasNext()) {
    const name = 'memberId_1_day_1';
    const index = (await attendance.indexes()).find(row => row.name === name);
    if (index?.unique && !index.partialFilterExpression) {
      if (JSON.stringify(index.key) !== JSON.stringify({ memberId: 1, day: 1 })) throw new Error(`Unexpected index definition: attendances.${name}`);
      console.log(`${apply ? 'Repair' : 'Would repair'} attendances.${name}`);
      if (apply) {
        await attendance.dropIndex(name);
        await attendance.dropIndex(`${name}_legacy_valid`).catch(() => {});
        await attendance.createIndex({ memberId: 1, day: 1 }, {
          name, unique: true,
          partialFilterExpression: { memberId: { $type: 'objectId' }, day: { $type: 'string' } },
        });
      }
    }
  }
} finally {
  await mongoose.disconnect();
}
