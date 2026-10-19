import { AppError } from '../utils/AppError.js';

export function notFound(_req, res) {
  res.status(404).json({ message: 'API endpoint not found.' });
}
export function errorHandler(err, _req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof AppError) return res.status(err.status).json({ message: err.message });
  if (err?.code === 11000) return res.status(409).json({ message: err.keyPattern?.email ? 'An account with this email already exists.' : 'A conflicting record already exists. Refresh and try again.' });
  if (['ValidationError', 'StrictModeError', 'CastError'].includes(err?.name)) return res.status(400).json({ message: 'Invalid request details.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request body.' });
  if (err?.status === 413) return res.status(413).json({ message: 'Request body too large.' });
  if (['encoding.unsupported', 'charset.unsupported'].includes(err?.type)) return res.status(415).json({ message: 'Use uncompressed UTF-8 JSON for request bodies.' });
  if (['request.aborted', 'request.size.invalid'].includes(err?.type)) return res.status(400).json({ message: 'Incomplete request body.' });
  if (err instanceof URIError) return res.status(400).json({ message: 'Invalid request path.' });
  // Never log request bodies, tokens, connection strings, or database error details.
  console.error('Unhandled API error.');
  return res.status(500).json({ message: 'An unexpected error occurred.' });
}
