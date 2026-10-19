import { membershipStats } from './membershipService.js';
import { upcomingSessions } from './sessionService.js';
import { paymentStats } from './paymentService.js';
import User from '../models/User.js';
import { attendanceStats } from './attendanceService.js';

export async function getAdminDashboard(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [result] = await User.aggregate([{ $match: { archivedAt: null } }, { $facet: {
    counts: [{ $group: { _id: '$role', total: { $sum: 1 }, active: { $sum: { $cond: ['$active', 1, 0] } } } }],
    growth: [{ $match: { role: 'member', createdAt: { $gte: start, $lte: now } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } }],
    recentMembers: [{ $match: { role: 'member' } }, { $sort: { createdAt: -1, _id: -1 } }, { $limit: 5 },
      { $project: { _id: 0, id: { $toString: '$_id' }, name: 1, email: 1, active: 1, createdAt: 1 } }],
  } }]).option({ maxTimeMS: 5000 });
  const countFor = (role) => result.counts.find(item => item._id === role) || { total: 0, active: 0 };
  const members = countFor('member');
  const trainers = countFor('trainer');
  const registrations = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const month = date.toISOString().slice(0, 7);
    return { month, count: result.growth.find(item => item._id === month)?.count || 0 };
  });
  return {
    generatedAt: now.toISOString(), timezone: 'UTC',
    summary: { totalMembers: members.total, activeMemberAccounts: members.active,
      inactiveMemberAccounts: members.total - members.active, totalTrainers: trainers.total,
      activeTrainers: trainers.active, newMembersThisMonth: registrations.at(-1).count },
    registrations, period: { start: start.toISOString(), currentMonth: monthStart.toISOString() },
    recentMembers: result.recentMembers,
    modules: { memberships: await membershipStats(now), payments: await paymentStats(now),
      attendance: await attendanceStats(now), sessions: await upcomingSessions(now) },
  };
}
