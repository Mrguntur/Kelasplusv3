# KELAS+ Public Landing Page

Standalone React + TypeScript + Vite frontend for the public KELAS+ website.

## Local development

```bash
cd apps/landing
npm install
npm run dev
```

The landing page runs at http://localhost:5174 and links to the application at /app/.

## Production routing

Build output is generated in `dist/`. Publish this app at the domain root (`kelasplus.my.id/`). The authenticated web client is a separate build from `apps/web` and is served under `/app/`.

Do not place application authentication or private school data in this public frontend.
