# KELAS+ Mobile (staging)

Separate Flutter client for Android and iOS. This folder does not replace the website or backend.

## Current scaffold status

- Responsive Material 3 starting screen for Admin, Pimpinan Sekolah, and Guru.
- No login or production data access is wired yet.
- Firebase configuration files and secrets are intentionally not committed.
- Attendance offline queue and API integration are planned next, after the API/auth contract is reviewed.

## Local build (Windows PowerShell)

Install Flutter SDK and Android Studio with Android SDK, then:

```powershell
flutter doctor
flutter doctor --android-licenses
cd mobile
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

APK output: `build\app\outputs\flutter-apk\app-debug.apk`.

## Architecture constraints

- Keep `server/index.firestore.js`, Firebase Authentication, Cloud Firestore, the current website, and YoHost.
- Mobile requests will use HTTPS API endpoints only. Do not access Firestore directly from the mobile client for writes.
- Before auth integration, backend staging must support Firebase ID-token verification with Firebase Admin `verifyIdToken()`, while preserving the website's existing HTTP-only cookie session flow.
- Offline attendance must use a durable local queue, deduplicate retries, and retain server-side teacher/schedule/date validation. Do not silently bypass or fabricate attendance timestamps.
- Never commit service-account JSON, API secrets, signing keys, or production credentials.
- No production deploy, Firestore data/rules mutation, or YoHost change is authorized by this scaffold.
