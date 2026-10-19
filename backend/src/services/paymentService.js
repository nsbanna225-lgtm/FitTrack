import Payment from '../models/Payment.js';
import Membership from '../models/Membership.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
const literal = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const currentPayment = { memberId: { $type: 'objectId' }, periodId: { $type: 'objectId' } };
const scope = actor => ({ ...currentPayment, ...(actor.role === 'member' ? { memberId: actor.id } : {}) });
export const paymentView = row => ({ id: String(row._id), memberId: String(row.memberId), periodId: String(row.periodId), memberName: row.memberName, planName: row.planName, startAt: row.startAt, expiresAt: row.expiresAt, amountMinor: row.amountMinor, currency: row.currency, mode: row.mode, status: row.status, version: row.version, paidAt: row.paidAt, createdAt: row.createdAt, events: row.events.map(event => ({ status: event.status, at: event.at })) });
async function activeMember(memberId) {
  const member = await User.findOne({ _id: memberId, role: 'member', active: true, archivedAt: null }).lean();
  if (!member) throw new AppError(409, 'Restore and activate the member before changing payments.');
  return member;
}
export async function create(input, actor) {
  const memberId = actor.role === 'member' ? actor.id : input.memberId;
  const member = await activeMember(memberId);
  const membership = await Membership.findById(memberId).lean();
  const period = membership?.periods.find(row => String(row._id) === input.periodId);
  if (!period) throw new AppError(404, 'Membership period not found.');
  const existing = await Payment.findOne({ memberId, periodId: input.periodId }).lean();
  if (existing) return paymentView(existing);
  try {
    return paymentView(await Payment.create({ memberId, periodId: period._id, memberName: member.name, planName: period.planName, startAt: period.startAt, expiresAt: period.expiresAt, amountMinor: period.priceMinor, currency: period.currency, events: [{ status: 'pending', at: new Date(), actorId: actor.id }] }));
  } catch (error) {
    // Retries and concurrent creation resolve to the same immutable charge.
    if (error.code === 11000) return paymentView(await Payment.findOne({ memberId, periodId: input.periodId }).lean());
    throw error;
  }
}
export async function transition(id, input, actor, retry = false, now = new Date()) {
  const payment = await Payment.findOne({ _id: id, ...scope(actor) }).lean();
  if (!payment) throw new AppError(404, 'Payment not found.');
  await activeMember(payment.memberId);
  const previous = retry ? 'failed' : 'pending';
  if (payment.version !== input.expectedVersion || payment.status !== previous) throw new AppError(409, 'Payment changed or this action is unavailable. Refresh and try again.');
  if (payment.events.length >= 100) throw new AppError(409, 'Simulation attempt limit reached.');
  const updated = await Payment.findOneAndUpdate({ _id: id, ...scope(actor), version: input.expectedVersion, status: previous }, {
    $set: { status: input.outcome, paidAt: input.outcome === 'paid' ? now : null },
    $inc: { version: 1 }, $push: { events: { status: input.outcome, at: now, actorId: actor.id } },
  }, { returnDocument: 'after', runValidators: true }).lean();
  if (!updated) throw new AppError(409, 'Payment changed. Refresh and try again.');
  return paymentView(updated);
}
export async function list(input, actor) {
  const filter = { ...scope(actor), ...(actor.role === 'admin' && input.memberId ? { memberId: input.memberId } : {}), ...(input.status !== 'all' ? { status: input.status } : {}), ...(input.q ? { memberName: { $regex: literal(input.q), $options: 'i' } } : {}) };
  const [records, total] = await Promise.all([Payment.find(filter).sort({ createdAt: -1, _id: -1 }).skip((input.page - 1) * 10).limit(10).lean(), Payment.countDocuments(filter)]);
  return { records: records.map(paymentView), pagination: { total, page: input.page, pages: Math.ceil(total / 10) } };
}
export async function paymentStats(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [totals, recent] = await Promise.all([
    Payment.aggregate([{ $match: { status: 'paid', mode: 'simulation', paidAt: { $lte: now } } }, { $group: { _id: null, totalMinor: { $sum: '$amountMinor' }, monthMinor: { $sum: { $cond: [{ $gte: ['$paidAt', monthStart] }, '$amountMinor', 0] } }, paidCount: { $sum: 1 } } }]).option({ maxTimeMS: 5000 }),
    Payment.find({ ...currentPayment, createdAt: { $lte: now } }).sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
  ]);
  return { available: true, mode: 'simulation', currency: 'INR', totalMinor: totals[0]?.totalMinor || 0, monthMinor: totals[0]?.monthMinor || 0, paidCount: totals[0]?.paidCount || 0, recent: recent.map(paymentView) };
}
