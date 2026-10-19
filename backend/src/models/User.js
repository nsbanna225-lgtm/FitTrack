import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, default: '', maxlength: 25 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'trainer', 'member'], default: 'member', required: true },
  active: { type: Boolean, default: true },
  archivedAt: { type: Date, default: null },
  tokenVersion: { type: Number, default: 0, select: false },
  resetTokenHash: { type: String, select: false },
  resetTokenExpiresAt: { type: Date, select: false },
}, { timestamps: true, strict: 'throw' });

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, createdAt: 1 });
export default mongoose.model('User', userSchema);

export function publicUser(user) {
  return { id: String(user._id), name: user.name, email: user.email, phone: user.phone,
    role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt };
}
