# KELAS+ PWA

KELAS+ is configured as an installable Progressive Web App for the existing YoHost + Express + Firebase deployment.

## Build output

Run `npm install` and `npm run build`. The `prebuild` script generates real 192x192 and 512x512 PNG app icons using Node built-ins, then Vite copies the manifest, icons, app shell and shared service worker into `dist/`.

## Included

- Installable manifest with Android-sized PNG icons, standalone display and KELAS+ branding.
- One root-scope service worker shared with Firebase Cloud Messaging (FCM), avoiding a competing PWA worker.
- App-shell caching and same-origin static asset caching with an offline navigation fallback.
- API paths are excluded from caching; authentication, attendance submissions, AI and Firestore-backed data are not claimed to work offline.
- CI checks backend/service-worker syntax, builds the frontend, validates generated icon dimensions and manifest, and uploads `dist/` as a downloadable GitHub Actions artifact.

## YoHost deployment checklist

1. Wait for the `KELAS+ PWA build` workflow to pass and download its `kelasplus-pwa-dist` artifact, or build the same branch on the YoHost app host.
2. Deploy the contents of `dist/` to the existing frontend document root on YoHost. Do not replace the Express backend, environment variables, Firebase service-account secret, Firestore, or API routes.
3. Preserve the existing HTTPS domain `https://www.kelasplus.my.id` and ensure the existing `/api` proxy/routing continues to reach Express.
4. Confirm these paths return HTTP 200 with the right content types: `/manifest.webmanifest`, `/firebase-messaging-sw.js`, `/pwa-192.png`, `/pwa-512.png`.
5. In Chrome Android, open the domain, wait for the service worker to activate, then use browser menu > Install app / Add to Home screen.
6. Test Admin, Leader and Teacher login, session restoration, attendance/journals, Learning Map, AI/API requests, and FCM foreground/background notifications.
7. After another deploy, confirm the service worker activates the new cache version `kelasplus-shell-v2` and the app updates cleanly.

## Build-time configuration

- `VITE_API_BASE_URL` defaults to `/api` for same-origin YoHost routing. If the existing Node/Express API is exposed on a different host or path, set this repository variable to the exact production API base URL before downloading/deploying the artifact.
- `VITE_FIREBASE_VAPID_KEY` must be set as a GitHub Actions repository variable to preserve browser push-notification registration in the downloadable artifact. Without it, the PWA can install but its notification activation flow will report the missing VAPID key. Use the public Web Push certificate key from the existing Firebase project; do not substitute the Firebase service-account JSON or any private server secret.

## Deployment safety

This change must not be merged to the production branch or considered live until the GitHub build passes and the built frontend has been deployed and smoke-tested on YoHost. The assistant does not have access to the YoHost control panel or deployment credentials, so the CI artifact is not itself a live production deployment.
