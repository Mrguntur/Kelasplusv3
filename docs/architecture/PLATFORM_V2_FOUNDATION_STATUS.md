# KELAS+ Platform V2 — Foundation Status

Branch: `feat/platform-v2-foundation`

## Implemented in this branch

- NestJS + TypeScript API skeleton with global DTO validation, Helmet security headers, explicit CORS origin allowlist and versioned `/api/v1` prefix.
- Liveness endpoint at `GET /api/v1/health`.
- PostgreSQL 17 local development service bound to loopback on port 5433.
- Prisma models and committed migrations for schools, users, memberships, sessions, lockout counters and school registration requests.
- Initial fail-closed RLS policies for schools, memberships and sessions.
- Disposable PostgreSQL CI service that applies migrations and runs cross-school RLS read/write denial tests.
- Opaque random session tokens; only SHA-256 token hashes are stored in the database.
- Argon2id password verification and hashing helper, generic login failure message, per-account temporary lockout after repeated failures, login rate limiting, HttpOnly session cookie, logout, logout-all, session validation, and protected `GET /api/v1/auth/me`.
- Password rotation endpoint that revokes active sessions.
- Browser Origin validation on cookie-changing auth routes.
- Public `POST /api/v1/schools/registration-requests` intake endpoint with DTO validation and rate limiting. It creates only a pending request; it does not create a school or user account.
- Unit tests for health response and cookie security policy.

## Verification

- The earlier backend-only CI run passed schema validation, type checking, build and unit tests before the database integration test was added.
- The RLS integration test exposed a cleanup-only failure: the test role still had schema privileges. The script was corrected to rely on disposable CI database teardown instead of dropping that role.
- The latest workflow after the auth and registration changes is running; do not treat this branch as green until the newest run completes successfully.

## Important security gaps — not production-ready

- No school registration review/approval flow or school-admin user-management endpoints yet.
- No email verification, invitation acceptance, password recovery, MFA, or platform-admin bootstrap flow yet.
- Rate limiting currently uses the in-process throttler; multi-instance production needs a shared store and proxy/IP trust configuration.
- RLS needs additional review for all future tenant-owned tables, plus explicit runtime/migration DB-role provisioning and tests using the exact runtime grants.
- No dedicated audit-event pipeline yet.
- No end-to-end API tests for login, logout, password rotation, expired/revoked sessions, or concurrent failed-login attempts yet.
- No React web client or Flutter client in this foundation branch.
- No shared/production database migration has been run. No deployment or changes to YoHost/Firebase have occurred.

## Immediate next tasks

1. Get the newest CI run green and fix any schema, SQL, type, or test failures.
2. Expand auth integration tests against disposable PostgreSQL and verify runtime DB grants.
3. Implement platform-admin bootstrap, verified registration review, invitation acceptance and role-checked user management.
4. Complete recovery/MFA/audit and threat-model review before real accounts are allowed.
5. Add academic modules only after tenant authorization and RLS tests are reliable.
6. Add React web and Flutter clients against the versioned API after the API contract stabilizes.

No production deployment, data migration, or production credential change is authorized by this work.
