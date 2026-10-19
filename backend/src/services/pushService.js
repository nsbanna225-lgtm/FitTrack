import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import User from '../models/User.js';

let configured = false;
let publicKey = '';

export function configurePush(config) {
  if (!config.publicKey || !config.privateKey || !config.subject) return false;
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  configured = true;
  publicKey = config.publicKey;
  return true;
}

export function pushConfiguration() {
  return { enabled: configured, publicKey: configured ? publicKey : null };
}

export async function saveSubscription(userId, input) {
  if (!configured) return false;
  const endpoint = new URL(input.endpoint);
  if (endpoint.protocol !== 'https:' || !input.keys?.p256dh || !input.keys?.auth) return false;
  await PushSubscription.updateOne(
    { endpoint: input.endpoint },
    { $set: { userId, endpoint: input.endpoint, keys: input.keys } },
    { upsert: true },
  );
  return true;
}

export async function removeSubscription(userId, endpoint) {
  await PushSubscription.deleteOne({ userId, endpoint });
}

export async function sendToUser(userId, notice) {
  if (!configured) return;
  const subscriptions = await PushSubscription.find({ userId }).lean();
  const payload = JSON.stringify({
    title: notice.title,
    body: notice.message,
    href: notice.href,
    tag: String(notice._id),
  });
  await Promise.all(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification(subscription, payload, { TTL: 86400 });
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: subscription._id });
      } else {
        console.warn('FitTrack push delivery failed.', error.statusCode || 'network error');
      }
    }
  }));
}

export async function syncSubscribedUsers(syncNotifications) {
  if (!configured) return;
  const userIds = await PushSubscription.distinct('userId');
  const users = await User.find({ _id: { $in: userIds }, active: true, archivedAt: null }).select('role').lean();
  for (const user of users) await syncNotifications(user);
}