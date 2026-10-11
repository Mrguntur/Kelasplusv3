# KELAS+ Firebase setup

Firebase project: `kelasplusgemi`.

## Configure the frontend
1. Copy `.env.example` to `.env.local` (preserve the existing backend variables).
2. Set `VITE_FIREBASE_API_KEY` to the Web App config's `apiKey`.
3. Confirm the other `VITE_FIREBASE_*` values match the Firebase Web App.
4. Never commit `.env.local`. Set these values in hosting environment settings for deployment.
5. Restart Vite after editing environment variables.

The Firebase Web API key is public client configuration. Never put a service-account JSON/private key in frontend code or any `VITE_*` variable.

## Enable services
In Firebase Console for `kelasplusgemi`:
- Authentication → Get started → Sign-in method → enable Email/Password.
- Firestore Database → Create database.
- Choose the production region carefully; Firestore's location cannot be changed later.
- Authentication → Settings → Authorized domains: add the production domain.

## Target Firestore collections
- `users/{uid}`: `name`, `username`, `role` (ADMIN / LEADER / TEACHER), `subject`, `assignedClasses`, `active`.
- `classes/{classId}`: `name`, `grade`, `homeroomTeacher`, `active`.
- `students/{studentId}`: `name`, `nisn`, `classId`, `gender`, `active`.
- `attendanceRecords/{recordId}`: `studentId`, `classId`, `date`, `status`, `recordedBy`.
- `journals/{journalId}`: `teacherId`, `classId`, `date`, `topic`, `method`, `text`.
- `assignmentTasks/{taskId}` and `assignmentScores/{scoreId}`.

Use Firebase Authentication UID as the user document ID. Never trust a role supplied by the browser.

## Security
Do not deploy with Firestore test mode or unrestricted rules. The included `firestore.rules` is a deliberately restrictive starting baseline: it blocks client writes until validated role-aware rules are implemented. Provision the first admin and assign roles using a trusted Admin SDK environment or controlled administrative process. Test security rules before migrating real student records.

## Migration status
This commit adds the Firebase Web SDK, environment-based initialization, starter Firestore rules, and this guide. It does **not** yet replace the Express/SQLite authentication and API operations. Keep the current API enabled until login, data reads/writes, user provisioning, authorization, and migration of existing data have been implemented and tested. The application is not fully migrated yet.
