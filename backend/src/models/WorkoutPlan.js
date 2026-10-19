import mongoose from 'mongoose';
export const workoutItemSchema = new mongoose.Schema({
  exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
  name: { type: String, required: true },
  exerciseInstructions: { type: String, default: '' },
  day: { type: Number, required: true, min: 1, max: 7 },
  sets: { type: Number, required: true, min: 1, max: 50 },
  reps: { type: Number, default: null, min: 1, max: 1000 },
  durationSeconds: { type: Number, default: null, min: 1, max: 7200 },
  restSeconds: { type: Number, required: true, min: 0, max: 3600 },
  instructions: { type: String, default: '', maxlength: 1000 },
}, { _id: false, strict: 'throw' });
const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, maxlength: 80 },
  instructions: { type: String, default: '', maxlength: 2000 },
  items: { type: [workoutItemSchema], required: true },
  active: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
}, { timestamps: true, strict: 'throw' });
schema.index({ ownerId: 1, active: 1, createdAt: -1 });
export default mongoose.model('WorkoutPlan', schema);
