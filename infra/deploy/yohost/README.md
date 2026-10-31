# YoHost / cPanel deployment — KELAS+ Platform V2

This runbook targets the known YoHost Laravel Student Mini (SSH OPEN) environment: cPanel, LiteSpeed, File Manager, and Setup Node.js App / Passenger.

## Safety boundary

**Deploy and validate on the existing staging domain first. Do not replace the current production `public_html`, its `.htaccess`, the live Firebase application, or its data.** The production site remains the legacy KELAS+ app until a separately approved cutover.

The current account was previously reported to have a small storage quota. Build frontend assets in GitHub Actions and upload only each `dist/` output; avoid running full frontend dependency installs on the hosting account.

## Intended URL layout

| Public URL | Destination |
| --- | --- |
| `/` | Landing build copied to the staging document root |
| `/app/` | Platform V2 web build copied to `app/` below that document root |
| `/api/v1/` | NestJS API registered in cPanel Node.js App Manager / Passenger |

The root `.htaccess` template is `infra/deploy/yohost/public_html.htaccess.example`.

## 1. Prepare the static frontends

Build artifacts are produced independently by GitHub Actions:
- Landing artifact: `kelasplus-platform-v2-landing-dist`
- Web artifact: `kelasplus-platform-v2-web-dist`

For the staging domain document root only:
1. Back up the current staging document root.
2. Copy the contents of the landing `dist/` artifact into the staging document root.
3. Create a subfolder named `app` and copy the contents of the web `dist/` artifact into it.
4. Copy `public_html.htaccess.example` to the staging document root as `.htaccess`.
5. Confirm `app/index.html` and `app/assets/` exist. The web build uses Vite base `/app/`.

Do not upload the source tree or `node_modules` into the public document root.

## 2. Register the API in cPanel

In **Setup Node.js App** (or Application Manager):
- Node.js version: Node 22 if the provider makes it available.
- Mode: Production.
- Application root: a private directory under the cPanel home directory, outside the public document root (example: `kelasplus-v2-api`).
- Application URL: staging domain + `/api/v1`.
- Startup file: `app.js`.

Upload the API source/build files to that private application root. The repository includes `services/api/app.js` as the Passenger startup shim. Build the NestJS application first so `dist/main.js` exists. Install only the dependencies required at runtime where possible; native `argon2` must be compatible with the hosting Node runtime.

Set these environment variables in the cPanel application:
- `NODE_ENV=production`
- `API_GLOBAL_PREFIX=api/v1`
- `CORS_ORIGINS=https://staging.kelasplus.my.id` (include the exact canonical origin actually used by the browser; add the production origin only during approved release)
- `DATABASE_URL` = private connection string for a PostgreSQL 17 database
- `PORT` = let cPanel/Passenger manage it unless the panel explicitly requires a value

Keep `API_GLOBAL_PREFIX=api/v1` for this Passenger mount. The NestJS controllers and cookie path are already based on `/api/v1`. The session cookie is HttpOnly, Secure in production, SameSite=Lax, and scoped to `/api/v1`.

Create the application's `tmp` directory if needed and restart it using cPanel's Restart control. Check the Passenger application log if startup fails.

## 3. Database prerequisite — do not skip

Platform V2 Prisma schema requires **PostgreSQL** (development uses PostgreSQL 17). The published YoHost Laravel Student Mini package specification lists MariaDB/MySQL databases, not PostgreSQL. Do not point `DATABASE_URL` at a MySQL/MariaDB database and do not attempt to run the PostgreSQL migrations there.

Before the API can be used, provide a reachable PostgreSQL 17 database (managed/external or a hosting service explicitly confirmed by YoHost). Use a dedicated V2 database and a restricted database user. Never reuse the production Firebase data or credentials. Only after a PostgreSQL endpoint is confirmed should a reviewed production/staging migration be run.

## 4. Smoke tests on staging

After static files and API are configured:
1. Open `https://staging.kelasplus.my.id/` — landing page loads and links to `/app/`.
2. Open `https://staging.kelasplus.my.id/app/` — application shell loads and Vite assets return 200.
3. Open `https://staging.kelasplus.my.id/app/a-nonexistent-client-route` — app shell is returned (SPA fallback).
4. Open `https://staging.kelasplus.my.id/api/v1/health` — API returns its health response.
5. In browser DevTools Network, verify API calls stay same-origin under `/api/v1`; do not proceed to login until the PostgreSQL database and schema are ready.
6. Confirm the current production `https://www.kelasplus.my.id` still serves the existing legacy application unchanged.

## 5. Production cutover — separate approval required

Only after staging passes, backups are verified, PostgreSQL is provisioned, schema migrations and security checks are reviewed, and an explicit release decision is made:
- back up production `public_html` and existing `.htaccess`;
- schedule a maintenance window;
- publish landing build to the production document root and web build to `/app/`;
- register/enable the API under production `/api/v1` with production environment variables;
- run health, login, cookie, role isolation, and SPA-route smoke tests;
- retain a rollback copy of the previous document root and process configuration.

This runbook and the repository changes do not themselves change the live YoHost account.
