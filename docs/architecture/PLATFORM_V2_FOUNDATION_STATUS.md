# KELAS+ Platform V2 — Foundation Status

Branch: `feat/platform-v2-foundation`

## Implemented in this branch

- NestJS + TypeScript API skeleton with DTO validation, Helmet security headers, explicit CORS allowlist and versioned `/api/v1` prefix.
- Health endpoint, local PostgreSQL 17 development service, Prisma schema and versioned migrations.
- Global identity, schools, memberships, sessions, registration requests, audit events, and school-admin invitation data models.
- Fail-closed PostgreSQL RLS policies for tenant rows, school membership discovery, registration review, audit writes, platform-admin provisioning, and token-scoped invitation acceptance.
- Authentication foundation: Argon2id password hashing, opaque random session tokens stored as SHA-256 hashes, HttpOnly cookie sessions, lockout and throttling, session validation, school discovery/selection, logout, logout-all, and password change with session revocation.
- Public school registration intake that creates only a pending request.
- Platform-admin registration review endpoints, pending-school approval, invitation email integration through Resend, and invitation acceptance that creates the school admin membership and activates the school.
- Unit, API e2e, and disposable PostgreSQL RLS tests.
- Security contracts and architecture notes.
- Academic data model proposal in `docs/architecture/PLATFORM_V2_ACADEMIC_DATA_MODEL.md`; this is design only and is not yet migrated into the database.

## Verification status

- On the latest invitation-acceptance run inspected, Prisma validation and all migrations passed, but the PostgreSQL RLS integration test failed due to two malformed dollar-quote delimiters in `services/api/test/rls.integration.sql`.
- The delimiter typo was corrected in commit `e1cc67048b3b804c8eeb209291dedd03a95173cc`. The follow-up CI result must be checked before calling the branch green; do not infer success from the fix alone.
- The legacy KELAS+ CI run for that previous commit passed. The Platform V2 API CI did not pass because the RLS script stopped at the SQL syntax error; typecheck/build/unit/e2e steps were skipped by the workflow.
- No production database migration, data import, deployment, or YoHost/Firebase configuration change has occurred.

## Remaining foundation risks / next steps

1. Confirm the corrected RLS integration test passes in CI; inspect and fix any subsequent failures before adding more runtime features.
2. Review invitation acceptance and all RLS policies using the non-owner runtime role and exact production-like grants.
3. Add database-backed authentication/invitation integration tests, including concurrent invitation claims, expired/revoked tokens, duplicate email races, and session creation after invitation acceptance.
4. Implement password recovery, verified email, MFA, platform-admin bootstrap and role-checked school user management before real accounts are allowed.
5. After the security baseline is green, implement the academic schema in small migration batches following the academic data model proposal, with tenant isolation and cross-school foreign-key tests for every batch.
6. Add React web and Flutter clients after the API contract and authorization boundaries stabilize.

## Deployment boundary

This is development work on `feat/platform-v2-foundation`. Draft PRs remain unmerged. Do not deploy, import legacy data, change production credentials, or run migrations against YoHost/Firebase without explicit approval.
