/* KELAS+ Firebase Cloud Messaging service worker.
 * Firebase web config is supplied as a URL-encoded query parameter by the app.
 * These values are public Firebase client configuration, never server secrets.
 */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification?.data?.url || 'https://kelasplus.my.id/?page=schedule';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

try {
  const encoded = new URL(self.location.href).searchParams.get('config');
  if (encoded) {
    const firebaseConfig = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage(payload => {
      const notification = payload.notification || {};
      const data = payload.data || {};
      const title = notification.title || 'Pengingat Mengajar';
      const options = {
        body: notification.body || 'Jadwal mengajar Anda akan segera dimulai.',
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: data.scheduleId ? 'kelasplus-' + data.scheduleId : 'kelasplus-reminder',
        data: { url: data.url || '/?page=schedule' }
      };
      return self.registration.showNotification(title, options);
    });
  }
} catch (error) {
  // Configuration errors are surfaced when the user enables notifications in KELAS+.
  console.error('KELAS+ messaging service worker initialization failed.');
}
