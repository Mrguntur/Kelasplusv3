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

## Verification status

- The last previously confirmed green CI commit was `2daeaff513c60e98b77eb7d1744f48c6394c1e84`; it predates the academic schema changes.
- The academic schema and migrations have been committed to this development branch, but the latest schema validation, migration execution, RLS SQL test, typecheck, build and API tests have **not yet been confirmed green**. Do not treat these changes as production-ready until the CI run is inspected and any failures are fixed.
- The schema/migration work is still being reviewed for consistency, including composite foreign keys, Prisma relation validation and SQL constraint behavior.
- No production database migration, data import, deployment, or YoHost/Firebase configuration change has occurred.

## Next steps

1. Get CI green for the academic schema and migration batch; inspect actual job logs rather than infer success.
2. Add robust RLS tests for all academic tables and cross-school write/update denials, not only year/term reads.
3. Implement role-checked API modules and integration tests for academic years, terms, staff, students, classes, subjects, assignments, attendance, journals and assessments.
4. Add score correction audit history and finalized attendance protections before enabling real school workflows.
5. Continue security hardening before connecting a production client.

## Deployment boundary

Work remains confined to `feat/platform-v2-foundation`. The `main` branch is not the development target. Do not merge, deploy, import legacy data, alter production credentials or run migrations against YoHost/Firebase without explicit approval.
