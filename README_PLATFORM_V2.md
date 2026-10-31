# KELAS+ Platform V2

Platform V2 is being developed alongside the existing KELAS+ application. It is **not yet a production replacement** and does not modify the current YoHost deployment, Firebase configuration, or production data.

## Technology stack

- API: NestJS + TypeScript, REST API under `/api/v1`
- Database: PostgreSQL 17
- ORM and migrations: Prisma
- Authentication: opaque server-side sessions, HttpOnly cookie, Argon2id password hashing
- Clients planned: React + TypeScript web client and Flutter mobile app
- Local infrastructure: Docker Compose for development only

## Monorepo frontend architecture

Platform V2 uses two independent web frontends in this repository:

- Public landing page: `apps/landing`, served at `https://kelasplus.my.id/`.
- Authenticated school workspace: `apps/web`, served at `https://kelasplus.my.id/app/`.
- REST API: `services/api`, routed under `/api/v1`.

Each frontend has its own package manifest, source code, build output, and CI workflow. The root-level application remains the legacy KELAS+ Firebase app and is intentionally left unchanged. See [the monorepo architecture decision](docs/PLATFORM_V2_MONOREPO_ARCHITECTURE.md) for local development, production routing, and release boundaries.

## Local development

Requirements: Node.js LTS, npm, and Docker Desktop.

1. Copy `.env.example` to `.env`; never commit real secrets.
2. Start local PostgreSQL: `docker compose -f infra/docker-compose.dev.yml up -d postgres`.
3. Open a terminal in `services/api`.
4. Install dependencies: `npm install`.
5. Generate Prisma client: `npm run prisma:generate`.
6. Apply migrations to the local development database: `npm run prisma:migrate:dev`.
7. Start the API: `npm run start:dev`.

Health check: `GET /api/v1/health`.

## Implemented API areas

All routes below are under `/api/v1`. Protected endpoints require the authenticated session cookie. A user must select an active school before accessing tenant-scoped academic data.

### Authentication and school access

- `POST /auth/login`
- `GET /auth/me`
- `GET /auth/schools`
- `POST /auth/select-school`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `POST /auth/change-password`

### School registration and invitations

- `POST /schools/registration-requests` — public, rate-limited request intake; does not immediately activate a school.
- `GET /schools/admin/registration-requests` — platform-admin allowlist only.
- `POST /schools/admin/registration-requests/:id/approve`
- `POST /schools/admin/registration-requests/:id/reject`
- `POST /schools/admin/registration-requests/:id/invite-admin`
- `POST /schools/invitations/accept`

### Academic data

- `GET|POST /academic/years`
- `GET|POST /academic/years/:yearId/terms`
- `GET|POST /academic/students`
- `GET|POST /academic/classes`
- `GET|POST /academic/staff`
- `GET|POST /academic/subjects`
- `GET|POST /academic/teaching-assignments`
- `GET|POST /academic/classes/:classId/enrollments`
- `GET /academic/classes/:classId/attendance-sessions`
- `POST /academic/classes/:classId/attendance-sessions`
- `POST /academic/attendance-sessions/:sessionId/records`
- `POST /academic/attendance-sessions/:sessionId/finalize`
- `GET|POST /academic/journals`
- `POST /academic/journals/:journalId/update`
- `POST /academic/journals/:journalId/submit`
- `GET|POST /academic/assessments`
- `GET /academic/assessments/:assessmentId/scores`
- `POST /academic/assessments/:assessmentId/scores`
- `POST /academic/assessments/:assessmentId/publish`
- `GET /academic/dashboard/summary` — role-aware dashboard summary.
- `GET /academic/reports/classes/:classId` — class attendance and published-assessment summary.

This list documents the currently implemented route surface, not a promise that the client UI is already connected. Confirm the current controller and DTOs for exact request/response fields.

## Security and tenant isolation

- Tenant-scoped operations establish the active user and school context inside a database transaction.
- PostgreSQL Row-Level Security (RLS) policies and composite same-school foreign keys are included and tested in CI.
- Role and ownership checks are applied in academic service operations.
- Authentication uses hashed opaque session tokens, HttpOnly cookies, throttling, and password hashing.
- Use synthetic local data only. Never use production credentials or real student data for development.

## CI verification

The Platform V2 API CI workflow runs Prisma client generation, schema validation, migrations against a disposable PostgreSQL instance, SQL tenant-RLS tests, TypeScript type checking, build, unit tests, and API security e2e tests.

A green CI run verifies the checks in that workflow for the tested commit. It does not mean the platform is deployed or that the new client UI has been implemented.

## Release boundary

- Do not deploy or run migrations against production without explicit release approval.
- Do not change the current YoHost/Firebase production application as part of Platform V2 development.
- Review security, backups, migrations, observability, and operational readiness before any production release.
