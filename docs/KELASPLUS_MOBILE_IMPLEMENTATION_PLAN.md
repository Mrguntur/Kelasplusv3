# KELAS+ Mobile — Implementation Plan & API/Auth Audit

## Scope and safety boundaries

- Separate Flutter application for Android and iOS.
- Preserve the existing React/Vite website, Express backend at `server/index.firestore.js`, Firebase Authentication, Cloud Firestore, and YoHost production hosting.
- All changes in this branch are staging-only. Do not deploy, merge to production, change Firestore rules/data, or rotate credentials without explicit approval.
- Keep the existing website cookie-session contract backward-compatible.

## Repository baseline audited

- Repository: `Mrguntur/Kelasplusv3`
- Baseline branch: `feat/kelasplus-platform-staging` (based on the Firestore read-optimization hotfix line).
- Package version: `2.3.0`
- Backend entry: `server/index.firestore.js`
- Firestore rules: client writes are denied; server-side Admin SDK is the write path.
- Existing read cache: 60 seconds, request coalescing and collection-scoped invalidation. Mobile work should not bypass it or add direct Firestore writes.
- `.env.example` still contains stale SQLite/initial-admin settings. This is a documentation/configuration cleanup finding, not an instruction to alter production environment variables.

## Initial API/auth findings

### Existing contract

- `GET /api/health`: returns status and database identifier.
- `POST /api/login`: accepts username/password, creates a server session, sets HTTP-only `kelasplus_session` cookie, and returns a Firebase custom token plus public user.
- `GET /api/auth/me`, `POST /api/auth/activity`, `POST /api/auth/logout`: currently use the cookie or a Bearer token representing the opaque server session.
- `GET /api/bootstrap`: role-scoped initial data.
- Existing write APIs include attendance, grades, tasks, journals, profile, user, class, and student management routes. Preserve all role checks.

### Mobile authentication blocker to resolve in staging

The current login response returns `firebaseCustomToken`, but the API's Bearer path hashes the supplied Bearer value and looks it up as an opaque session ID. It does not currently verify Firebase ID tokens. The raw opaque session token is not returned in JSON. Therefore a Flutter client cannot reliably use the current Bearer contract without cookie management.

Recommended compatibility change, after tests are added:
1. Flutter calls `POST /api/login` and receives the Firebase custom token.
2. Flutter signs in with Firebase Auth using that custom token, then obtains a short-lived Firebase ID token.
3. Add a separate, explicit Firebase ID-token verification path in backend auth middleware for Bearer ID tokens using Firebase Admin `verifyIdToken`; retain cookie/opaque-session auth for the website unchanged.
4. Resolve the active Firestore user profile and role on the server for every authenticated request; never trust role claims from the client alone.
5. Keep cookie auth and existing website behavior unchanged; add tests for expired, malformed, revoked/disabled, and wrong-project tokens.

Do not simply return the raw opaque session token to mobile or weaken Firestore rules.

## Offline attendance design

Use a local durable queue in the Flutter app (SQLite via Drift, or another maintained local store) for draft attendance submissions. Each queued operation should include a client-generated operation ID, class ID/name, school-local date, per-student status, created timestamp, current user ID, and sync state.

- Offline records are visibly marked “Belum tersinkron”.
- Never report a record as saved to the server until the API confirms success.
- On reconnect, sync in order and use idempotency keys or deterministic attendance IDs so retries do not duplicate attendance.
- Server remains authoritative for teacher assignment, role, date, and schedule-window rules. An offline record outside the permitted teaching window must be surfaced as rejected for review, not silently forced through.
- Handle partial/expired sessions by pausing the queue, prompting re-login, and retrying only after authentication is restored.
- Avoid background sync claims until platform permissions and lifecycle behavior have been tested on real devices.
- Use conflict handling if another device changes a student's attendance after the offline draft was created; show the server value and require a deliberate resolution.

## Proposed Flutter structure

```
mobile/
  pubspec.yaml
  lib/
    main.dart
    app/
      app.dart
      router.dart
      theme.dart
    core/
      config/
      networking/
      auth/
      storage/
      sync/
    features/
      login/
      dashboard/
      attendance/
      journals/
      learning_map/
      reports/
      users/
      classes/
      students/
      settings/
  test/
```

Use Flutter with feature-based modules, Dio (or a comparable HTTP client), Riverpod for state, GoRouter for navigation, secure storage for sensitive local tokens, and Drift/SQLite for the attendance queue. Dependencies should be pinned to compatible stable versions when the Flutter project is initialized.

## UI scope and navigation

- Visual language should follow the current KELAS+ website: familiar blue palette, typography, logo, and terminology, adapted to mobile rather than embedded web views.
- Role-aware navigation for ADMIN, LEADER, and TEACHER.
- Teacher: dashboard, attendance with offline queue, teaching journal, assignment/grade entry, student learning map, notifications.
- Leader: attendance and journal monitoring, student follow-up, reports and indicators.
- Admin: user, class, student, schedule, settings and account management.
- Hide unauthorized features in UI, but always enforce authorization in the API.

## Delivery stages and acceptance gates

1. **Audit and contract tests** — map API routes, request/response shapes, roles, error formats, and current session behavior. No production writes.
2. **Mobile auth compatibility** — implement and test Firebase ID-token verification alongside the existing cookie session.
3. **Flutter shell** — login, role-aware routing, theme, API client, loading/error states.
4. **Read-only dashboards** — bootstrap data and role-appropriate views.
5. **Online features** — journals, grades, admin workflows and reports, according to API coverage.
6. **Offline attendance** — durable drafts, safe retry/idempotency, conflicts and visible sync status.
7. **CI/builds** — analyze, test, and build Android APK/AAB; build/test iOS on macOS CI. iOS signing requires Apple developer credentials and will not be fabricated.
8. **Staging acceptance** — use test accounts and test data only; verify no changes to production data, existing website login, or YoHost deployment.

## Risks and open audit items

- Verify every route's role and ownership checks, especially any route not yet inspected.
- Test current login throttling and consider bounded cleanup of the in-memory rate-limit map.
- Audit initialization: backend startup may create initial admin, seed classes, and seed tasks. Do not run the production backend against an unintended database/environment during tests.
- Confirm CORS and HTTPS origins for production and mobile API access.
- Check API response sizes and role-scoped data before loading mobile dashboards.
- Confirm that the existing Firebase custom-token sign-in flow is only used for mobile identity, not direct client writes.
- Keep real service-account JSON and AI keys only in host secrets; never in Flutter assets, Git, or `VITE_*` variables.

## Explicit non-goals

- No migration to MySQL or a new database.
- No replacement of Express or `server/index.firestore.js`.
- No direct client writes to Firestore.
- No production deployment, merge, data mutation, or Firestore rules change without explicit approval.
