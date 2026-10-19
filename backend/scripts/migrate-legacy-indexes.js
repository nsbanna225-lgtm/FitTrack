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
} finally {
  await mongoose.disconnect();
}
