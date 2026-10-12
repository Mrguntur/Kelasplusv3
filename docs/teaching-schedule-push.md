# KELAS+ Teaching Schedule & Push Reminder (implementation notes)

## Current implementation in this branch

- Adds authenticated schedule APIs:
  - `GET /api/schedules`: Admin/Leader can view all schedules; Teacher sees only their own.
  - `POST /api/schedules`: Admin only.
  - `PATCH /api/schedules/:id`: Admin only.
  - `DELETE /api/schedules/:id`: soft-deactivates a schedule.
- Prevents overlapping active schedules for the same teacher and weekday.
- Adds per-user device token registration:
  - `POST /api/notifications/register` with `{ "token": "...", "platform": "web" | "android" }`
  - `DELETE /api/notifications/register` with `{ "token": "..." }`
- Adds protected dispatch endpoint `POST /api/internal/notifications/dispatch`.
- Schedule weekday numbering is ISO-style: Monday=1 through Sunday=7.
- Schedule and dispatch times use `Asia/Jakarta` (WIB), appropriate for Bajuin, South Kalimantan.
- The dispatch endpoint is designed to be called once per minute by a trusted server-side cron job. It sends FCM notification payloads to registered device tokens and uses Firestore dispatch records to avoid duplicate sends.

## Important: this branch is not a complete, activated feature yet

The React schedule screen is now included on this branch for Admin, Leader, and Teacher. Admin can add and deactivate schedules; teachers see their own schedules and can request browser notification registration. The browser service worker is included. This is still a draft until the hosting configuration, build, end-to-end delivery, and Android native push are validated. Do not describe reminders as live before those checks pass.

## Required server configuration

Set a long random `CRON_SECRET` (at least 32 characters) in the hosting environment. Do not commit it to GitHub or put it in browser code. Keep the existing Firebase Admin service-account configuration private and server-only.

Configure a cPanel cron job to call the dispatch endpoint every minute using an HTTP client that sends header `X-Cron-Secret: <CRON_SECRET>`. Do not place the actual secret in a public repository or a URL/query string. If the hosting provider does not permit reliable one-minute cron jobs or outbound HTTPS requests, use a managed scheduler/Cloud Scheduler instead.

## Background behavior

- Web/PWA: FCM web push requires HTTPS, notification permission, a Firebase Messaging service worker, a Web Push certificate/VAPID key, and a registered browser token. Delivery can still be affected by browser settings, battery saver, OS restrictions, and connectivity.
- Android APK: native FCM registration and notification permission must be implemented in the Android shell. A WebView alone does not guarantee push notifications when the app is closed.
- The server sends reminders; it does not keep the React page running in the background. This is the correct approach for closed/background apps.

## Validation before production

1. Configure `VITE_FIREBASE_VAPID_KEY` in the frontend build environment using the Web Push certificate public key from Firebase Console > Project settings > Cloud Messaging. The `VITE_` key is public; never use a private server secret here.
2. Confirm the other `VITE_FIREBASE_*` client config values are available at build time and that the Firebase project has Cloud Messaging enabled.
3. Configure `CRON_SECRET` (at least 32 random characters) only in the server environment and configure a trusted one-minute scheduler to call the dispatch endpoint.
4. Build and deploy this branch to a staging URL; verify schedule CRUD and role access with Admin, Leader, and Teacher accounts.
5. On HTTPS Chrome, grant notification permission and use the KELAS+ screen to register the browser token. Check the `notificationDevices` collection only through trusted admin tooling.
6. Test a schedule with a reminder five minutes ahead, including duplicate cron invocations and invalid/expired device tokens.
7. Add native Android FCM token registration to the APK separately; browser push registration does not complete native Android push.
