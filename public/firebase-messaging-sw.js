/* KELAS+ shared PWA + Firebase Cloud Messaging service worker.
 * Firebase web config is supplied as a URL-encoded query parameter by the app.
 * Only the app shell and same-origin static assets are cached. API, auth and
 * Firebase requests are deliberately excluded to avoid stale/private data.
 */
const KELASPLUS_CACHE = 'kelasplus-shell-v1';
const KELASPLUS_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa-192.svg',
  '/pwa-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(KELASPLUS_CACHE);
    await Promise.all(KELASPLUS_SHELL.map(async path => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (response.ok) await cache.put(path, response);
      } catch (_) {
        // A single optional shell resource should not prevent worker install.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('kelasplus-shell-') && key !== KELASPLUS_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\/api(?:\/|$)/.test(url.pathname) || /notifications|firebase-messaging-sw\.js/.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(KELASPLUS_CACHE);
      try {
        const response = await fetch(request);
        if (response && response.ok) await cache.put('/index.html', response.clone());
        return response;
      } catch (_) {
        return (await cache.match(request)) || (await cache.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // Cache-first for Vite's fingerprinted assets and same-origin static files.
  if (url.pathname.startsWith('/assets/') || /\.(?:css|js|svg|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(KELASPLUS_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return Response.error();
      }
    })());
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification?.data?.url || 'https://www.kelasplus.my.id/?page=schedule';
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
      // FCM displays notification payloads automatically in the background.
      // Manually show only data-only messages to avoid duplicate notifications.
      if (payload.notification) return;
      const notification = payload.notification || {};
      const data = payload.data || {};
      const title = notification.title || 'Pengingat Mengajar';
      const options = {
        body: notification.body || 'Jadwal mengajar Anda akan segera dimulai.',
        icon: '/pwa-192.svg',
        badge: '/pwa-192.svg',
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
