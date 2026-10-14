# KELAS+ Android internal APK

This branch packages the existing React/Vite UI with Capacitor for internal school testing. The Express API and Firebase services remain hosted separately. This workflow builds a **debug APK for testing**, not a Play Store release.

## GitHub Actions variables

In **Settings → Secrets and variables → Actions → Variables**, add these repository variables using the same public Firebase web configuration currently used by the deployed frontend:

- `VITE_API_BASE_URL`: the deployed backend URL ending in `/api`, for example `https://your-backend.example.com/api`. Use the real HTTPS URL; never use `localhost`.
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY` (optional for this build; browser-based web push is not native Android push)

These are frontend configuration values, not service-account credentials. **Never add `FIREBASE_SERVICE_ACCOUNT_JSON`, private keys, or other backend secrets to Vite variables or the APK.** Keep backend-only secrets in the hosting provider's secret settings.

## Backend configuration required before login testing

1. In the backend hosting environment, add `https://localhost` to `FRONTEND_ORIGIN`, preserving the existing approved origins as comma-separated entries.
2. Redeploy the backend branch only after reviewing and testing the session-cookie change in this branch. For the Capacitor origin, the backend sets `SameSite=None; Secure`; the generated Android WebView explicitly permits third-party cookies for the existing cookie-based API session. Other origins retain the existing `SameSite=Lax` behavior.
3. Confirm the API is HTTPS and its CORS configuration allows credentials for `https://localhost`.
4. Do not merge this branch into the production branch until the checks below pass.

## Build the APK

1. Open the **Actions** tab in GitHub.
2. Select **KELAS+ Android Internal APK**.
3. Run workflow manually with **Run workflow**, or push a commit to this branch.
4. Wait for the job to finish successfully.
5. Open the completed run, download artifact **kelasplus-internal-debug-apk**, unzip it, and install `app-debug.apk` on a test Android device.

The artifact expires after 14 days. Debug APKs are intended for controlled testing, not public distribution.

## Required device checks

- Login and logout for Admin, Leader, and Teacher.
- Session persists after navigating between pages and after app restart.
- Attendance, teaching journals, schedules, students/classes, announcements, and reports load and save correctly.
- Network errors and expired sessions are handled safely.
- Test on more than one Android version/device if possible.
- Confirm Firestore and backend logs before approving rollout.

The existing reminder implementation uses browser service workers and Firebase Web Messaging. **Native Android push notifications are not included in this first APK build** and must be implemented/tested separately if they are required. This workflow does not deploy the backend or change production hosting automatically.
