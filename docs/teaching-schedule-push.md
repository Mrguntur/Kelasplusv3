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

The React Admin/Teacher schedule screens, browser permission/token registration, service worker setup, and Android native FCM token integration must be added and tested before users receive reminders. Do not merge/deploy this branch as a complete user-facing feature yet.

## Required server configuration

Set a long random `CRON_SECRET` (at least 32 characters) in the hosting environment. Do not commit it to GitHub or put it in browser code. Keep the existing Firebase Admin service-account configuration private and server-only.

Configure a cPanel cron job to call the dispatch endpoint every minute using an HTTP client that sends header `X-Cron-Secret: <CRON_SECRET>`. Do not place the actual secret in a public repository or a URL/query string. If the hosting provider does not permit reliable one-minute cron jobs or outbound HTTPS requests, use a managed scheduler/Cloud Scheduler instead.

## Background behavior

- Web/PWA: FCM web push requires HTTPS, notification permission, a Firebase Messaging service worker, a Web Push certificate/VAPID key, and a registered browser token. Delivery can still be affected by browser settings, battery saver, OS restrictions, and connectivity.
- Android APK: native FCM registration and notification permission must be implemented in the Android shell. A WebView alone does not guarantee push notifications when the app is closed.
- The server sends reminders; it does not keep the React page running in the background. This is the correct approach for closed/background apps.

## Validation before production

1. Add schedule management UI and validate role-based access.
2. Add and test web FCM service-worker registration/token registration.
3. Add native Android FCM token registration for the APK.
4. Configure `CRON_SECRET` and the trusted scheduler on hosting.
5. Test a schedule with a reminder five minutes ahead, including duplicate cron invocations and invalid/expired device tokens.
6. Confirm that notification permission is explicitly granted on each device.
