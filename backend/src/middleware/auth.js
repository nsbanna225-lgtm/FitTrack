import User from '../models/User.js';
import { verifyToken } from '../services/tokenService.js';
import { AppError } from '../utils/AppError.js';

export async function authenticate(req, _res, next) {
  const header = req.get('authorization');
  if (!header || !/^Bearer \S+$/i.test(header) || header.length > 4096) throw new AppError(401, 'Authentication required.');
  let payload;
  try { payload = verifyToken(header.slice(7)); }
  catch { throw new AppError(401, 'Session is invalid or expired. Please log in again.'); }
  if (!payload || typeof payload !== 'object' || !/^[a-f0-9]{24}$/i.test(payload.sub || '') || !Number.isInteger(payload.ver)) {
    throw new AppError(401, 'Session is invalid or expired. Please log in again.');
  }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || !user.active || user.tokenVersion !== payload.ver) throw new AppError(401, 'Session is invalid or expired. Please log in again.');
  req.user = user;
  next();
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw new AppError(401, 'Authentication required.');
    if (!roles.includes(req.user.role)) throw new AppError(403, 'You do not have permission to perform this action.');
    next();
  };
}
