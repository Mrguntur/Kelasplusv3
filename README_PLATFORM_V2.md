# KELAS+ Platform V2 — Foundation

This is a clean platform foundation alongside the existing trial app. It does not replace or modify the current website/backend, Firebase, YoHost, or production data.

## Stack
- API: NestJS + TypeScript, REST under `/api/v1`
- Database: PostgreSQL
- Schema/migrations: Prisma (migration history is committed; production migrations must be reviewed)
- Clients later: React + TypeScript and Flutter
- Local infrastructure: Docker Compose for development only

## Local API development
Requirements: Node.js LTS, npm, Docker Desktop.

1. Copy `.env.example` to `.env` (never commit real secrets).
2. Start local PostgreSQL: `docker compose -f infra/docker-compose.dev.yml up -d postgres`
3. In a terminal: `cd services/api`
4. `npm install`
5. `npx prisma generate`
6. `npx prisma migrate dev`
7. `npm run start:dev`

Health endpoint: `GET http://localhost:3000/api/v1/health`

The initial endpoint exposes health/status only. No school data, login, or production database is connected yet.

## Safety
- Use synthetic local data only.
- Never use production credentials or production student data in development.
- Do not deploy or run migrations against production without an explicit release approval.
- Database runtime role and RLS tenant policies must be designed/tested before any tenant data endpoints are implemented.
