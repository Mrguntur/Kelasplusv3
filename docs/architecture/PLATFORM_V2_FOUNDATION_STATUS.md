# KELAS+ Platform V2 — Foundation Status

Branch: `feat/platform-v2-foundation`

## Implemented in this branch
- NestJS + TypeScript API skeleton with global validation, Helmet security headers, explicit CORS origin allowlist and versioned `/api/v1` prefix.
- Liveness endpoint at `GET /api/v1/health`.
- PostgreSQL 17 local development service bound to loopback on port 5433.
- Initial Prisma schema for schools, users, school memberships and sessions.
- Prisma lifecycle module and CI workflow for schema validation, type checks, build and unit tests.
- API-specific environment template.

## Explicitly not production-ready yet
- No login or account recovery endpoints.
- No tenant-owned data endpoints.
- No database migration has been applied to any shared/production database.
- PostgreSQL RLS policies and runtime DB-role separation are still required before implementing tenant data access.
- Authentication, password hashing, refresh-token rotation, CSRF, MFA, rate limiting and audit logging need implementation and tests before real accounts are created.
- CI has not been observed passing yet; inspect Actions before treating this foundation as verified.

## Immediate next engineering tasks
1. Confirm CI is green and fix any compile/test/schema issues.
2. Add committed, reviewed SQL migration(s), including RLS policy tests and a safe transaction-local tenant context strategy.
3. Add a database integration-test environment.
4. Implement identity and session lifecycle, password hashing, rate limiting, recovery, revocation and audit trail.
5. Add school onboarding and membership flows.
6. Add API authorization tests that prove cross-tenant access is denied.
7. Add OpenAPI contract and staging-only deployment pipeline after security review.

No production deploy, data migration, or production credential change is authorized by this work.
