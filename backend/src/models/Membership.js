import mongoose from 'mongoose';
const period = new mongoose.Schema({
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
  planName: { type: String, required: true },
  durationDays: { type: Number, required: true },
  priceMinor: { type: Number, required: true },
  currency: { type: String, required: true },
  features: { type: [String], default: [] },
  startAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  recordedAt: { type: Date, required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { _id: true, strict: 'throw' });
// One atomic document per member prevents overlapping concurrent enrollments/renewals.
const schema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, required: true, default: 1 },
  periods: { type: [period], required: true, validate: value => value.length > 0 && value.length <= 200 },
}, { timestamps: true, strict: 'throw' });
export default mongoose.model('Membership', schema);
