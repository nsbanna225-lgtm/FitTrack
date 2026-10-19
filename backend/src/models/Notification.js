import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true },
  kind: { type: String, enum: ['booking', 'session_reminder', 'membership_expiry', 'payment_reminder', 'workout_update'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  href: { type: String, required: true },
  occurredAt: { type: Date, required: true },
  expiresAt: { type: Date, default: null },
  readAt: { type: Date, default: null },
}, { strict: 'throw', versionKey: false });
// Legacy notifications lack these keys; deduplicate current notifications only.
schema.index({ recipientId: 1, key: 1 }, {
  unique: true,
  partialFilterExpression: { recipientId: { $type: 'objectId' }, key: { $type: 'string' } },
});
schema.index({ recipientId: 1, readAt: 1, occurredAt: -1, _id: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('Notification', schema);
