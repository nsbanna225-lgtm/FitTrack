import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trainerName: { type: String, required: true },
  memberName: { type: String, required: true },
  timezone: { type: String, required: true },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' },
  version: { type: Number, default: 1, required: true },
  // Each occupied 15-minute block reserves BOTH participants in this same atomic write.
  // Cancelled sessions use an empty array. A partial index avoids indexing empty arrays.
  reservations: { type: [String], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, strict: 'throw' });
schema.index({ reservations: 1 }, { unique: true, partialFilterExpression: { status: 'scheduled' } });
schema.index({ trainerId: 1, startAt: 1 });
schema.index({ memberId: 1, startAt: 1 });
schema.index({ startAt: 1, status: 1 });
export default mongoose.model('Session', schema);
