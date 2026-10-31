# KELAS+ Platform V2 — Foundation Status

Development branch: `feat/platform-v2-foundation`

## Implemented foundation

- NestJS + TypeScript API skeleton, DTO validation, Helmet, explicit CORS allowlist and versioned `/api/v1` prefix.
- PostgreSQL 17 development service and Prisma-backed schema/migrations.
- Global identities, schools, memberships, sessions, registration requests, audit events and school-admin invitations.
- Authentication foundation using Argon2id, opaque random session tokens stored as SHA-256 hashes, HttpOnly cookies, lockout/throttling, session validation, school selection and logout/password-change flows.
- School registration intake, platform-admin review/approval, invitation email integration and invitation acceptance.
- Fail-closed RLS baseline and disposable PostgreSQL integration checks.
- Architecture and security contract documents.

## Academic schema added on this branch

- Academic years and terms.
- Staff profiles and student records with limited personal data.
- School classes, class enrollments and same-school composite foreign keys.
- Subjects and teaching assignments.
- Attendance sessions and attendance records.
- Teaching journals, assessments and assessment scores.
- RLS enabled and forced on academic tables, with tenant policies requiring transaction-local school context and a matching membership.
- SQL integration coverage expanded for academic year/term visibility, missing context and cross-school term references.

## Client implementation on this branch

- React + TypeScript web workspace under `apps/web`, with session-aware API client and role-aware workspace shell.
- Academic year/term, class roster, attendance session, teaching journal and assessment workflows.
- Assessment scoring validates score ranges, saves scores before publication, requires all active students to have a score, and locks published assessments in the client.
- Class academic report summarizes finalized attendance and published assessments and supports browser print / Save as PDF.
- Responsive styles for academic forms, tables and report printing.
- These screens are development UI only. They are not deployed to YoHost and do not connect to the existing production Firebase app.

## Verification status

- Latest confirmed commit: `46423e33d0a894ed182201f59a1b4baf572bdc4c` (2026-10-29).
- GitHub Actions for that commit passed: KELAS+ Platform V2 Web CI, KELAS+ Platform V2 API CI, and KELAS+ CI. The API workflow includes Prisma schema validation/generation, migration checks against disposable PostgreSQL, RLS SQL tests, TypeScript checks/build and API tests; the web workflow validates/builds the client.
- Passing CI is a code-quality gate, not a live end-to-end test against a real school database or proof of production readiness.
- The pull request remains a draft for review. No merge, production database migration, data import, deployment, or YoHost/Firebase configuration change has occurred.

## Remaining release work

1. Review and expand automated authorization tests for each role, tenant boundary and academic write operation.
2. Add explicit tests for score correction/audit history and finalized attendance protections before real school use.
3. Run a complete local smoke test with synthetic data: login, select school, roster, attendance, journal, scoring, publication and PDF report.
4. Review accessibility, mobile behavior, loading/error/empty states, and print layout.
5. Complete security and operational review (backups, migration rollback, logging/monitoring, secrets, rate limits and incident recovery).
6. Prepare a separate release checklist and obtain explicit approval before any merge, migration or deployment.

## Deployment boundary

Work remains confined to `feat/platform-v2-foundation`. The `main` branch is not the development target. Do not merge, deploy, import legacy data, alter production credentials or run migrations against YoHost/Firebase without explicit approval.
