# KELAS+ Platform V2 Web

Separate React and TypeScript client for Platform V2. This folder is isolated from the legacy root application.

## Local development

Requirements: Node.js 22+ and the Platform V2 API running at `http://localhost:3000`.

1. Run `npm install` in this folder.
2. Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` if needed.
3. Make sure the API configuration allows the exact origin `http://localhost:5173`.
4. Run `npm run dev` and open `http://localhost:5173`.

## Build

Run `npm run build`; use `npm run preview` to preview the production build locally.

## Session security

Requests include browser credentials. The web client never reads or stores the session token in JavaScript or local storage. Production requires HTTPS and an exact allowed web origin in API CORS settings.

This app does not deploy or change the existing YoHost/Firebase production application.
