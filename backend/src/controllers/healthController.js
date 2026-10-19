import { isDatabaseReady } from '../config/database.js';

export function getHealth(_req, res) {
  res.status(200).json({ status: 'ok', service: 'fittrack-api', message: 'FitTrack backend is running.' });
}

export async function getReadiness(_req, res) {
  const ready = await isDatabaseReady();
  res.set('Cache-Control', 'no-store');
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'unavailable',
    service: 'fittrack-api',
    database: ready ? 'connected' : 'disconnected',
  });
}
