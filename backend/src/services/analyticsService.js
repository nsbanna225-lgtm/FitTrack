import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Payment from '../models/Payment.js';
import Session from '../models/Session.js';

export async function analytics({ from, to, interval }, now = new Date()) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(Math.min(Date.parse(`${to}T00:00:00Z`) + 86400000, +now + 1));
  const range = { $gte: start, $lt: end };
  const key = field => ({ $dateToString: { date: `$${field}`, format: interval === 'day' ? '%Y-%m-%d' : '%Y-%m', timezone: 'UTC' } });
  const aggregate = (model, match, group) => model.aggregate([{ $match: match }, { $group: group }]).option({ maxTimeMS: 5000 });
  const [registrations, attendance, revenue, sessions, visitors] = await Promise.all([
    aggregate(User, { role: 'member', createdAt: range }, { _id: key('createdAt'), count: { $sum: 1 } }),
    aggregate(Attendance, { checkedInAt: range }, { _id: key('checkedInAt'), count: { $sum: 1 } }),
    aggregate(Payment, { mode: 'simulation', currency: 'INR', status: 'paid', paidAt: range }, { _id: key('paidAt'), amount: { $sum: '$amountMinor' }, count: { $sum: 1 } }),
    aggregate(Session, { startAt: range }, { _id: { period: key('startAt'), status: '$status' }, count: { $sum: 1 } }),
    Attendance.aggregate([{ $match: { checkedInAt: range } }, { $group: { _id: '$memberId' } }, { $count: 'count' }]).option({ maxTimeMS: 5000 }),
  ]);
  const rows = [];
  const cursor = new Date(start);
  if (interval === 'month') cursor.setUTCDate(1);
  while (cursor < end) {
    const period = cursor.toISOString().slice(0, interval === 'day' ? 10 : 7);
    const pay = revenue.find(row => row._id === period);
    const row = { period, registrations: registrations.find(row => row._id === period)?.count || 0,
      visits: attendance.find(row => row._id === period)?.count || 0, revenueMinor: pay?.amount || 0, paidPayments: pay?.count || 0 };
    for (const status of ['scheduled', 'completed', 'cancelled']) row[status] = sessions.find(row => row._id.period === period && row._id.status === status)?.count || 0;
    rows.push(row);
    if (interval === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const totals = Object.fromEntries(['registrations', 'visits', 'revenueMinor', 'paidPayments', 'scheduled', 'completed', 'cancelled'].map(key => [key, rows.reduce((sum, row) => sum + row[key], 0)]));
  return { from, to, interval, timezone: 'UTC', generatedAt: now.toISOString(), rows, totals: { ...totals, uniqueVisitors: visitors[0]?.count || 0 } };
}
