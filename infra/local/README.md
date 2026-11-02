# KELAS+ Platform V2 — Local Development

This guide runs the V2 application separately from the existing legacy KELAS+ Firebase application.
It does not modify production or the legacy root app.

## Requirements

- Windows 10/11 with PowerShell
- Git
- Node.js 22 LTS (npm included)
- Docker Desktop (Linux containers enabled)

## 1. Get the development branch

```powershell
git clone --branch feat/platform-v2-ui-modernization https://github.com/Mrguntur/Kelasplusv3.git
cd Kelasplusv3
```

If you already have the repository:

```powershell
git fetch origin
git switch feat/platform-v2-ui-modernization
git pull
```

## 2. Start local PostgreSQL

From the repository root:

```powershell
docker compose -f infra/local/docker-compose.yml up -d
docker compose -f infra/local/docker-compose.yml ps
```

Wait until the postgres service reports healthy.

## 3. Configure API environment

```powershell
Copy-Item services/api/.env.example services/api/.env
```

The example is configured for the local Docker database on port 5433. Keep secrets local; never commit `.env`.

## 4. Install and prepare the API

Open PowerShell in the repository root:

```powershell
Set-Location services/api
npm install
npx prisma generate
npx prisma validate
npx prisma migrate deploy
npm run typecheck
npm run build
```

To run API unit tests:

```powershell
npm test -- --runInBand
```

To run API end-to-end tests:

```powershell
npm run test:e2e -- --runInBand
```

The e2e suite may require its documented test environment and seed data; do not point it at production.

## 5. Start the API

In the API terminal:

```powershell
npm run start:dev
```

API base URL: `http://localhost:3000/api/v1`.

Health check (if the health route is enabled):

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health
```

## 6. Start the V2 web app

Open a second PowerShell window at repository root:

```powershell
Set-Location apps/web
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173/app/`.

The web client uses `VITE_API_BASE_URL=http://localhost:3000/api/v1`. The API allows the local web origin `http://localhost:5173` and cookie credentials.

## 7. Stop local services

Stop Vite and NestJS with Ctrl+C. Stop PostgreSQL without deleting its data:

```powershell
docker compose -f infra/local/docker-compose.yml down
```

To delete the local database volume and all local test data (irreversible):

```powershell
docker compose -f infra/local/docker-compose.yml down -v
```

## Important safety notes

- These commands run Platform V2 only. The root-level legacy Firebase app and `server/index.firestore.js` are not used by this guide.
- Do not copy production credentials or production database URLs into local `.env` files.
- Local PostgreSQL is disposable development data; never run destructive reset commands against a production database.
- School administrator invitation creation is still a platform-admin workflow. Acceptance endpoints are not a substitute for issuing a real invitation.
- The V2 branch and PR remain unmerged; this guide does not deploy anything to YoHost.
