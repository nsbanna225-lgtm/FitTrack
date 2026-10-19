import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  memberName: { type: String, required: true },
  day: { type: String, required: true },
  checkedInAt: { type: Date, required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  source: { type: String, enum: ['member', 'admin'], required: true },
}, { strict: 'throw', versionKey: false });
// Preserve legacy member/date documents while enforcing uniqueness for current check-ins.
schema.index({ memberId: 1, day: 1 }, {
  unique: true,
  partialFilterExpression: { memberId: { $type: 'objectId' }, day: { $type: 'string' } },
});
schema.index({ day: -1, checkedInAt: -1, _id: -1 });
schema.index({ checkedInAt: 1, memberId: 1 });
export default mongoose.model('Attendance', schema);
