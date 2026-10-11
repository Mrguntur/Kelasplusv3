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
- `assignmentTasks/{taskId}` and `teacherAssignmentScores/{scoreId}`.
- `appSettings/{settingId}` and `auditLogs/{logId}`.
- `userCredentials/{uid}`: password hash and login metadata; backend-only.
- `sessions/{tokenHash}`: hashed session token, user ID, expiry, revocation; backend-only.

Use Firebase Authentication UID as the user document ID. Never trust a role supplied by the browser.

## Security
Do not deploy with Firestore test mode or unrestricted rules. The included `firestore.rules` blocks all client writes and specifically denies client reads of `userCredentials` and `sessions`. The Express backend uses Firebase Admin SDK, so server routes must enforce roles and ownership checks. Test security rules before using real student records.

## Firestore backend branch status
The `feat/firestore-primary-backend` branch adds a Firestore-first Express backend and points `dev:backend` and `start` at it. It stores user profiles, server-only password hashes, sessions, classes, students, attendance, journals, assignment tasks/scores, app settings, and audit logs in Firestore. The legacy SQLite backend file is retained but is no longer the configured entry point on this branch.

This code has **not yet been validated end-to-end against the live Firebase project**. Before merging or deploying, test login and all Admin, Leader, and Teacher workflows. This branch does not import existing SQLite records; it initializes the starter classes if the Firestore classes collection is empty. The SQLite file is not deleted.

## Required backend environment
Configure these values in the backend environment only:
- `FIREBASE_SERVICE_ACCOUNT_JSON`: full service-account JSON for project `kelasplusgemi`.
- `INITIAL_ADMIN_USERNAME`: initial Admin username.
- `INITIAL_ADMIN_PASSWORD`: initial Admin password, at least 12 characters.
- `FRONTEND_ORIGIN`: frontend origin, for example `http://localhost:5173`.
- Optional: `GEMINI_API_KEY` and `GEMINI_MODEL` for AI recommendations.

Never place the service-account JSON in a `VITE_*` variable or commit it to GitHub. Password hashes are stored in `userCredentials`, not in user profile documents. The browser uses Firebase Authentication custom-token sign-in, while application data is accessed through the authenticated Express API. Keep client writes denied in Firestore rules.
