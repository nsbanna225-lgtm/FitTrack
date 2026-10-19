import mongoose from 'mongoose';
const interval = new mongoose.Schema({
  day: { type: Number, required: true, min: 0, max: 6 },
  start: { type: String, required: true },
  end: { type: String, required: true },
}, { _id: false, strict: 'throw' });
const schema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  specializations: { type: [String], default: [] },
  experienceYears: { type: Number, default: 0, min: 0, max: 80 },
  bio: { type: String, default: '', maxlength: 2000 },
  timezone: { type: String, default: 'Asia/Kolkata' },
  availability: { type: [interval], default: [] },
}, { timestamps: true, strict: 'throw' });
export default mongoose.model('Trainer', schema);
