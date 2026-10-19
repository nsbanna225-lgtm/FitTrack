import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
}, { timestamps: true, strict: 'throw', versionKey: false });

schema.index({ endpoint: 1 }, { unique: true });
schema.index({ userId: 1 });

export default mongoose.model('PushSubscription', schema);