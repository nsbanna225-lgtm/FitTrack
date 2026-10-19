import mongoose from 'mongoose';
import { workoutItemSchema } from './WorkoutPlan.js';
const schema = new mongoose.Schema({
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutPlan', required: true },
  planVersion: { type: Number, required: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  memberName: { type: String, required: true },
  trainerName: { type: String, required: true },
  name: { type: String, required: true },
  instructions: { type: String, default: '' },
  items: { type: [workoutItemSchema], required: true },
  completed: { type: [Boolean], required: true },
  completedCount: { type: Number, default: 0 },
  itemCount: { type: Number, required: true },
  archived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  version: { type: Number, default: 1 },
}, { timestamps: true, strict: 'throw' });
schema.index({ planId: 1, memberId: 1 }, { unique: true, partialFilterExpression: { archived: false } });
schema.index({ memberId: 1, createdAt: -1 });
export default mongoose.model('WorkoutAssignment', schema);
