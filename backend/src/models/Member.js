import mongoose from 'mongoose';
// One optional extension per member account; _id references the User directly.
const schema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTrainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  goals: { type: String, default: '', maxlength: 1000 },
  notes: { type: String, default: '', maxlength: 2000 },
}, { timestamps: true, strict: 'throw' });
export default mongoose.model('Member', schema);
