import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  periodId: { type: mongoose.Schema.Types.ObjectId, required: true },
  memberName: { type: String, required: true },
  planName: { type: String, required: true },
  startAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  amountMinor: { type: Number, required: true, min: 0, max: 100000000 },
  currency: { type: String, enum: ['INR'], default: 'INR' },
  mode: { type: String, enum: ['simulation'], default: 'simulation' },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  version: { type: Number, default: 1 },
  paidAt: { type: Date, default: null },
  events: [{ _id: false, status: { type: String, enum: ['pending', 'paid', 'failed'] }, at: Date, actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
}, { timestamps: true, strict: 'throw', versionKey: false });
// Legacy payments lack these keys; retain them without weakening current payment uniqueness.
schema.index({ memberId: 1, periodId: 1 }, {
  unique: true,
  partialFilterExpression: { memberId: { $type: 'objectId' }, periodId: { $type: 'objectId' } },
});
schema.index({ status: 1, paidAt: -1 });
schema.index({ memberId: 1, createdAt: -1, _id: -1 });
export default mongoose.model('Payment', schema);
