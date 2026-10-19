import Notification from '../models/Notification.js';
import Session from '../models/Session.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import WorkoutAssignment from '../models/WorkoutAssignment.js';
import { sendToUser, syncSubscribedUsers as syncPushUsers } from './pushService.js';
import { AppError } from '../utils/AppError.js';
const DAY = 86400000;
const plus = (date, milliseconds) => new Date(+new Date(date) + milliseconds);
const time = date => new Date(date).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const view = row => ({ id: String(row._id), kind: row.kind, title: row.title, message: row.message, href: row.href, occurredAt: row.occurredAt, readAt: row.readAt });

// Candidates always come from current authoritative records. This avoids dual-write
// failures on standalone MongoDB and never makes a successful booking depend on inbox writes.
export async function candidates(actor, now = new Date()) {
  if (actor.archivedAt || actor.role === 'admin') return [];
  const recent = plus(now, -30 * DAY), result = [];
  const add = (key, kind, title, message, href, occurredAt, expiresAt = null) => {
    if (+new Date(occurredAt) <= +now && (!expiresAt || +expiresAt > +now)) result.push({ recipientId: actor._id, key: `${actor.role}:${key}`, kind, title, message, href, occurredAt, expiresAt });
  };
  const sessions = await Session.find({ [actor.role === 'trainer' ? 'trainerId' : 'memberId']: actor._id,
    $or: [{ updatedAt: { $gte: recent, $lte: now } }, { status: 'scheduled', startAt: { $gt: now, $lte: plus(now, DAY) } }] }).select('memberName trainerName startAt endAt status version updatedAt').maxTimeMS(5000).lean();
  for (const row of sessions) {
    const partner = actor.role === 'trainer' ? row.memberName : row.trainerName;
    const day = row.startAt.toISOString().slice(0, 10);
    const href = `/${actor.role}/sessions?from=${day}&to=${plus(row.startAt, DAY).toISOString().slice(0, 10)}&status=all`;
    const title = row.status === 'cancelled' ? 'Session cancelled' : row.status === 'completed' ? 'Session completed' : row.version > 1 ? 'Session rescheduled' : 'Booking confirmed';
    if (row.updatedAt >= recent) add(`booking:${row._id}:${row.version}`, 'booking', title, `Session with ${partner}: ${time(row.startAt)}.`, href, row.updatedAt, plus(row.updatedAt, 30 * DAY));
    if (row.status === 'scheduled' && row.startAt > now && row.startAt <= plus(now, DAY)) add(`session:${row._id}:${row.version}`, 'session_reminder', 'Session in the next 24 hours', `Your session with ${partner} starts at ${time(row.startAt)}.`, href, new Date(Math.max(+row.updatedAt, +row.startAt - DAY)), row.startAt);
  }
  if (actor.role !== 'member') return result;
  const [membership, payments, workouts] = await Promise.all([
    Membership.findById(actor._id).select('periods').lean(),
    Payment.find({ memberId: actor._id, status: { $in: ['pending', 'failed'] }, mode: 'simulation' }).select('planName amountMinor currency status version updatedAt').maxTimeMS(5000).lean(),
    WorkoutAssignment.find({ memberId: actor._id, $or: [{ createdAt: { $gte: recent, $lte: now } }, { archivedAt: { $gte: recent, $lte: now } }] }).select('name createdAt archived archivedAt').maxTimeMS(5000).lean(),
  ]);
  const periods = (membership?.periods || []).toSorted((a, b) => +a.startAt - +b.startAt);
  let end, terminal;
  for (const period of periods) {
    if ((!end && period.startAt <= now && period.expiresAt > now) || (end && period.startAt <= end && period.expiresAt > end)) { end = period.expiresAt; terminal = period; }
  }
  if (end && end <= plus(now, 7 * DAY)) {
    add(`expiry:${terminal._id}:soon`, 'membership_expiry', 'Membership expires soon', `Your current continuous coverage ends at ${time(end)}. Review your membership before then.`, '/member/membership', plus(end, -7 * DAY), end);
  } else if (!end) {
    const expired = periods.filter(p => p.expiresAt <= now).at(-1);
    if (expired && expired.expiresAt > plus(now, -7 * DAY)) add(`expiry:${expired._id}:expired`, 'membership_expiry', 'Membership has expired', `Your coverage ended at ${time(expired.expiresAt)}. Review your membership to arrange renewal.`, '/member/membership', expired.expiresAt, plus(expired.expiresAt, 7 * DAY));
  }
  for (const row of payments) {
    add(`payment:${row._id}:${row.version}`, 'payment_reminder', row.status === 'failed' ? 'Demo payment needs a retry' : 'Demo payment pending', `${row.planName}: ${row.currency} ${(row.amountMinor / 100).toFixed(2)}. This is a simulation; no real money is collected.`, '/member/payments', row.updatedAt);
  }
  for (const row of workouts) {
    const occurredAt = row.archived ? row.archivedAt : row.createdAt;
    add(`workout:${row._id}:${row.archived ? 'archived' : 'assigned'}`, 'workout_update', row.archived ? 'Workout archived' : 'New workout assigned', `${row.name}. ${row.archived ? 'Your recorded completion is retained in workout history.' : 'Open your workout to review the exercises and instructions.'}`, `/member/workouts/assignments/${row._id}`, occurredAt, plus(occurredAt, 30 * DAY));
  }
  return result;
}

export async function sync(actor, now = new Date()) {
  const items = await candidates(actor, now);
  if (items.length) {
    const operations = items.map(item => ({ updateOne: { filter: { recipientId: actor._id, key: item.key }, update: { $setOnInsert: item }, upsert: true } }));
    let insertedIds = [];
    try {
      const result = await Notification.bulkWrite(operations, { ordered: false });
      insertedIds = Object.values(result.upsertedIds || {});
    }
    catch (error) {
      // Another request can win the unique-key upsert race. Ignore only duplicate-key writes.
      if (!error.writeErrors?.length || error.writeErrors.some(e => e.code !== 11000) || error.writeConcernErrors?.length) throw error;
    }
    if (insertedIds.length) {
      const inserted = await Notification.find({ _id: { $in: insertedIds } }).lean();
      await Promise.all(inserted.map(async item => {
        try { await sendToUser(item.recipientId, item); }
        catch (error) { console.warn('FitTrack push delivery failed.', error.statusCode || 'network error'); }
      }));
    }
  }
  return { recipientId: actor._id, key: { $in: items.map(item => item.key) } };
}

export async function syncSubscribedUsers(now = new Date()) {
  await syncPushUsers(actor => sync(actor, now));
}
export async function list(input, actor, now = new Date()) {
  const scope = await sync(actor, now);
  const filter = { ...scope, ...(input.status !== 'all' ? { readAt: input.status === 'unread' ? null : { $ne: null } } : {}), ...(input.kind !== 'all' ? { kind: input.kind } : {}) };
  const [records, total, unread] = await Promise.all([
    Notification.find(filter).sort({ occurredAt: -1, _id: -1 }).skip((input.page - 1) * 10).limit(10).lean(),
    Notification.countDocuments(filter), Notification.countDocuments({ ...scope, readAt: null }),
  ]);
  return { records: records.map(view), unread, pagination: { total, page: input.page, pages: Math.ceil(total / 10) }, refreshedAt: now };
}
export async function unread(actor, now = new Date()) {
  const scope = await sync(actor, now);
  return { unread: await Notification.countDocuments({ ...scope, readAt: null }), refreshedAt: now };
}
export async function mark(id, read, actor, now = new Date()) {
  const scope = await sync(actor, now);
  const current = await Notification.findOne({ _id: id, ...scope }).lean();
  if (!current) throw new AppError(404, 'Notification is no longer available. Refresh your inbox.');
  // Repeated mark-read calls retain the original read time.
  if (read) await Notification.updateOne({ _id: id, recipientId: actor._id, readAt: null }, { $set: { readAt: now } });
  else await Notification.updateOne({ _id: id, recipientId: actor._id }, { $set: { readAt: null } });
  return { success: true };
}
