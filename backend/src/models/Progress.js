import mongoose from 'mongoose';
const measure = { type: Number, min: 1, max: 300, default: null };
const schema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  day: { type: String, required: true },
  weightKg: { type: Number, required: true, min: 1, max: 500 },
  heightCm: { type: Number, min: 30, max: 250, default: null },
  waistCm: measure, chestCm: measure, hipsCm: measure,
  notes: { type: String, maxlength: 2000, default: '' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, default: 1 },
}, { timestamps: true, strict: 'throw', versionKey: false });
schema.index({ memberId: 1, day: -1 }, { unique: true });
export default mongoose.model('Progress', schema);
