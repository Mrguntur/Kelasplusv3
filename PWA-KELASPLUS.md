# KELAS+ PWA

KELAS+ is configured as an installable Progressive Web App (PWA).

## Included

- Web app manifest with Indonesian app name, standalone display, theme colors and app icons.
- Root-scope service worker shared with Firebase Cloud Messaging (FCM), so the PWA does not register a competing worker.
- App-shell caching and cache-first handling for same-origin static assets.
- Network-first navigation handling with a cached app-shell fallback.
- API and notification endpoints are excluded from caching to avoid serving stale or private application data.
- GitHub Actions build check.

## Release checklist

1. Merge the PWA branch only after the GitHub Actions build succeeds.
2. Deploy the merged frontend and public assets to the HTTPS production host.
3. Confirm these URLs return successfully: /manifest.webmanifest, /firebase-messaging-sw.js, /pwa-192.svg and /pwa-512.svg.
4. In Chrome on Android, open https://www.kelasplus.my.id, open the browser menu, and select Install app or Add to Home screen.
5. Launch the installed KELAS+ icon and test login, role-based screens, attendance, journals, Learning Map, AI features and FCM notifications.
6. Test a new deployment and confirm the worker updates to kelasplus-shell-v1 without retaining outdated assets.

## Offline expectations

The service worker caches the app shell and static assets. This does not make Firestore data, login, attendance submissions, AI features, or other API operations fully offline-capable. Those operations still need connectivity unless an explicit offline data queue and sync workflow is implemented.

## FCM compatibility

The app and FCM use the same root-scope worker at /firebase-messaging-sw.js. The app's notification activation flow can continue registering the same worker with its encoded Firebase web configuration query parameter. Do not add a second root-scope PWA worker without consolidating it with this worker.
