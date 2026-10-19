import mongoose from 'mongoose';
import {demoDatabase,seedDemo} from './demo-data.js';
import {validatePassword} from '../src/validators/authValidators.js';
try {
  const database=demoDatabase(process.env.DEMO_DB);
  const password=validatePassword(process.env.DEMO_PASSWORD);
  // Deliberately ignore MONGODB_URI and .env: demo writes are local and isolated.
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`,{serverSelectionTimeoutMS:5000});
  const result=await seedDemo({password});
  console.log(JSON.stringify(result,null,2));
  console.log(result.alreadySeeded?'Demo already seeded; existing data and passwords preserved.':'Demo ready. Active accounts use the supplied DEMO_PASSWORD.');
} catch {
  console.error('Demo seed failed. Check local MongoDB, DEMO_DB naming and DEMO_PASSWORD (12+ characters, at most 72 UTF-8 bytes). Use a fresh demo database suffix after an incomplete run. Existing databases are never reset.');
  process.exitCode=1;
} finally {
  delete process.env.DEMO_PASSWORD;
  await mongoose.disconnect();
}
