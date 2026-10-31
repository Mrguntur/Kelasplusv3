# KELAS+ Platform V2 — Monorepo Architecture

**Decision:** one Git repository with independently built frontends and a separately deployed API.

## Public URL map

| URL | Application | Build source |
| --- | --- | --- |
| `https://kelasplus.my.id/` | Public landing page | `apps/landing` |
| `https://kelasplus.my.id/app/` | Authenticated school workspace | `apps/web` |
| `https://kelasplus.my.id/api/v1/` | Platform V2 REST API | `services/api` |

The landing page and authenticated workspace are separate React applications. They have separate dependencies, source trees, build outputs, and release lifecycles. Shared design primitives can be extracted to a package only when there is a real reuse need; the two frontends should not be coupled merely to share styling.

## Repository boundaries

- `apps/landing`: public marketing and product information. No private student or school records and no authentication secrets.
- `apps/web`: authenticated Platform V2 client, mounted at `/app/`.
- `services/api`: NestJS REST API, mounted behind `/api/v1/`.
- `infra`: local development infrastructure.
- Root-level files and the root Vite/Firebase application: legacy KELAS+ application. Keep its scripts, deployment, Firebase configuration, and production data unchanged during V2 development.

## Local development

Open separate terminals:

```bash
cd apps/landing && npm install && npm run dev
cd apps/web && npm install && npm run dev
cd services/api && npm install && npm run start:dev
```

Landing page: `http://localhost:5174`. Platform V2 web: `http://localhost:5173/app/`. API: `http://localhost:3000/api/v1`.

## Production routing

The production web server or reverse proxy must route:
- `/` to the landing build output.
- `/app/*` to the web build output, with SPA fallback to the web app's `index.html`.
- `/api/v1/*` to the API service.

Preserve the `/app/` prefix when serving the web app because Vite emits asset paths using that base. Configure API CORS and cookie settings for same-origin production use; keep HTTPS enabled.

## Release safety

Platform V2 is developed alongside the existing YoHost/Firebase application. Do not overwrite its document root, change its process, run V2 migrations against production, or move production traffic until a separately approved release plan, backup, and smoke-test procedure are ready.
