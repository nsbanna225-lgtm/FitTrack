import { rateLimit } from 'express-rate-limit';

// Single-process development limits; use a shared store before scaling horizontally.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 100,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { message: 'Too many authentication requests. Try again later.' },
});
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { message: 'Too many unsuccessful attempts. Try again later.' },
});
export const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { message: 'Too many password reset requests. Try again later.' },
});
