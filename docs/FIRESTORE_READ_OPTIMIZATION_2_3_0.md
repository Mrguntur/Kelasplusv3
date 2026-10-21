# KELAS+ 2.3.0 — Firestore Read Optimization

## Changes
- Increase short-lived process cache TTL from 8s to 60s for repeat collection/query reads.
- Invalidate only affected collection caches after known mutations; unknown mutation routes still safely clear all cache entries.
- Attendance validation now reads students only from the selected class instead of the full students collection.
- Grade saving fetches the selected student and class by document ID and limits task/score reads to the relevant teacher or student.
- Student create/edit duplicate NISN checks use indexed equality queries instead of listing every student.
- Class deletion checks only students in that class.

## Safety
- Authentication/session/credential collections are not added to the read cache.
- This branch is a staging candidate; it does not deploy to YoHost or alter Firebase data.
- Run npm ci, npm run build, node --check server/index.firestore.js, and functional tests before release.
- Compare Firestore read operations using the same user flow and time window before/after deployment.

## Remaining work
- Admin/leader bootstrap still needs bounded, page-specific endpoints for large attendance and journal histories.
- The cache is process-local; multiple backend instances do not share cache entries.
