import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 80 },
  nameKey: { type: String, required: true, unique: true },
  durationDays: { type: Number, required: true, min: 1, max: 3660 },
  priceMinor: { type: Number, required: true, min: 0, max: 100000000 },
  currency: { type: String, enum: ['INR'], default: 'INR' },
  features: { type: [String], default: [] },
  active: { type: Boolean, default: true },
}, { timestamps: true, strict: 'throw' });
export default mongoose.model('MembershipPlan', schema);
