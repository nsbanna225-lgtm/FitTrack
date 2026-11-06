import mongoose from 'mongoose';
import {sampleDatabase,seedsample} from './sample-data.js';
import {validatePassword} from '../src/validators/authValidators.js';
try {
  const database=sampleDatabase(process.env.SAMPLE_DB);
  const password=validatePassword(process.env.SAMPLE_PASSWORD);
  // Deliberately ignore MONGODB_URI and .env: sample writes are local and isolated.
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`,{serverSelectionTimeoutMS:5000});
  const result=await seedsample({password});
  console.log(JSON.stringify(result,null,2));
  console.log(result.alreadySeeded?'sample already seeded; existing data and passwords preserved.':'sample ready. Active accounts use the supplied sample_PASSWORD.');
} catch {
  console.error('sample seed failed. Check local MongoDB, sample_DB naming and sample_PASSWORD (12+ characters, at most 72 UTF-8 bytes). Use a fresh sample database suffix after an incomplete run. Existing databases are never reset.');
  process.exitCode=1;
} finally {
  delete process.env.SAMPLE_PASSWORD;
  await mongoose.disconnect();
}

