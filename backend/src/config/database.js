import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

export async function connectDatabase(uri) {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 10,
      autoIndex: false,
    });
  } catch (cause) {
    throw new Error('MongoDB connection failed. Check MONGODB_URI and database availability.', { cause });
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export async function isDatabaseReady() {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 2000 });
    return true;
  } catch {
    return false;
  }
}
