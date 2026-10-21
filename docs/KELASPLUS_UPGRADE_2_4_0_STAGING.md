# KELAS+ Upgrade 2.4.0 — Smart Assistant & Data Efficiency

## Included in this staging branch
- Version bumped to 2.4.0.
- Added a floating robot assistant panel to the authenticated application.
- Added an authenticated `POST /api/ai/chat` endpoint that uses the server-side `GEMINI_API_KEY`; the API key is never sent to the browser.
- Assistant requests are limited to 1,200 characters and model output is capped to keep requests bounded. The prompt tells the assistant not to invent student records or request passwords/tokens.
- Added call-center links: email `guntursaputra.22.gs@gmail.com` and WhatsApp `https://wa.me/6285230607122`.
- Login page now has a school information/welcome panel on desktop and displays the static school name `UPTD SMPN 2 BAJUIN`.
- Added a Learning Map action to save all non-empty grade drafts for students in classes assigned to the current teacher. The UI confirms the number of values and reports partial failures.
- Kept the Firestore backend and the 2.3.0 read-cache optimizations as the base.

## Important data retention decision
- Existing student/class deletion routes soft-deactivate records. This is intentional for now because attendance, grades, journals, and reports may reference those records.
- Do not automatically hard-delete student/class records or all related collections until a reviewed retention policy and verified cascade mapping are approved. Firestore does not automatically delete subcollections when a parent document is deleted.
- Task deletion currently deletes related score documents for the task. Test this carefully against historical reports before production rollout.

## Required environment and testing
- The Gemini chat feature requires `GEMINI_API_KEY` to be configured on the backend host. If not configured, the UI falls back to local help guidance.
- Confirm `GEMINI_MODEL` is a model enabled for the configured API key; the route defaults to the same model setting used by the existing AI recommendation route.
- Run `npm ci`, `npm run build`, `node --check server/index.firestore.js`, and `node --check server/schedule-routes.js`.
- Functional test login roles, chatbot success and fallback, mail/WhatsApp links, global grade save, partial-save recovery, cache invalidation, and existing attendance/journal/schedule/notification workflows.
- Compare Firestore read counts before and after using the same workflow.
- This is a staging branch only. It has not been deployed to YoHost and must not be treated as a production release until CI and functional tests pass.
