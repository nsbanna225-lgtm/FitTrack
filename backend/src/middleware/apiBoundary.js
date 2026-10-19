import { AppError } from '../utils/AppError.js';

// Run before parsing so rejected bodies receive the same protections as routes.
export function apiBoundary(req, res, next) {
  res.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  });
  const hasBody = Number(req.get('content-length')) > 0 || req.get('transfer-encoding');
  if (hasBody && !req.is('application/json')) {
    return next(new AppError(415, 'Use application/json for request bodies.'));
  }
  next();
}
