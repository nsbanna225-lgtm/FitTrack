import { AppError } from '../utils/AppError.js';
import { list } from './progressValidators.js';
export function analyticsQuery(query, now = new Date()) {
  if (Object.keys(query).some(key => !['from', 'to', 'interval'].includes(key)) || (query.interval !== undefined && !['day', 'month'].includes(query.interval))) throw new AppError(400, 'Use from, to, and interval (day or month) only.');
  const { from, to } = list(Object.fromEntries(Object.entries(query).filter(([key]) => key !== 'interval')), now);
  return { from, to, interval: query.interval || 'month' };
}
