self.addEventListener('push', event => {
  let notice = {};
  try { notice = event.data?.json() || {}; } catch { notice = { body: event.data?.text() || '' }; }
  event.waitUntil(self.registration.showNotification(notice.title || 'FitTrack', {
    body: notice.body || 'You have a new update.',
    icon: '/fittrack-icon.svg',
    badge: '/fittrack-icon.svg',
    tag: notice.tag || 'fittrack-update',
    data: { href: notice.href || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const href = event.notification.data?.href;
  const target = typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') ? new URL(href, self.location.origin).href : self.location.origin;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const client = clients.find(item => new URL(item.url).origin === self.location.origin);
    if (client) return client.navigate(target).then(() => client.focus());
    return self.clients.openWindow(target);
  }));
});