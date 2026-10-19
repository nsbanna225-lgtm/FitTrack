import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, maxlength: 80 },
  instructions: { type: String, default: '', maxlength: 1000 },
  active: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
}, { timestamps: true, strict: 'throw' });
schema.index({ ownerId: 1, active: 1, createdAt: -1 });
export default mongoose.model('Exercise', schema);
