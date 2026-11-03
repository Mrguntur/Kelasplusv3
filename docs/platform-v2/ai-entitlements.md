# KELAS+ Platform V2 AI Entitlements

## Server configuration

Set these values in the API runtime environment (never in browser code):

- `GEMINI_API_KEY`: server-side Google AI API key.
- `GEMINI_MODEL`: optional model name; defaults to `gemini-2.5-flash`.

Do not commit secrets or put the key in Vite/client environment variables.

## Plan feature flags

AI access is fail-closed. Both a boolean capability and a positive monthly request quota are required.

| Capability | Plan feature | Monthly quota feature | Allowed school roles |
|---|---|---|---|
| Teacher assistant | `aiAssistant: true` | `aiTeacherMonthlyRequests: <integer>` | TEACHER, SCHOOL_ADMIN |
| Leadership insights | `aiLeadershipInsights: true` | `aiLeadershipMonthlyRequests: <integer>` | SCHOOL_LEADER, SCHOOL_ADMIN |

The product rule is enforced by the API: only plan codes `GROWTH` (Berkembang) and `UNGGULAN` may use these capabilities, even if a lower-tier plan is accidentally configured with AI flags. Rintisan must leave them disabled/omitted. Existing plan records are not changed by this migration; Super Admin must configure them deliberately after review.

## API routes

- `GET /ai/capabilities` returns the active member's role- and plan-specific AI capabilities and monthly limits for dashboard discovery.
- `POST /ai/teacher/assistant`
- `POST /ai/leadership/insights`

Both routes require an authenticated session, active school membership, an active subscription/trial, matching role permission, and remaining monthly quota. Request body: `{ "question": "..." }` (5–3,000 characters).

## Privacy and cost controls

- The API constructs school context from aggregate counts; it does not query or send student names, NISN, email, addresses, or individual score rows. Attendance aggregates include only `FINALIZED` sessions.
- Common email, Indonesian mobile-number, and 10-digit identifier patterns are redacted from the submitted question. Name detection is not reliable, so users must not include student names or other identifying details in prompts; the V2 dashboard displays this warning before requests are submitted.
- Teacher context is restricted to the teacher's assigned classes.
- Leadership context uses school-level aggregates.
- Monthly quota boundaries use UTC calendar months. Each accepted request reserves one monthly request before calling Gemini. Failed provider calls are recorded and still consume one request to prevent retries from bypassing quotas.
- Trusted safety instructions and aggregate context are sent separately from the user's question using Gemini's system-instruction field to reduce prompt-injection risk.
- Provider output is capped at 900 tokens and requests time out after 30 seconds.
- Usage events record capability, model, status, token counts, tenant, actor, and timestamp under tenant RLS.

## Operational checklist

1. Configure the Gemini key in the V2 API secret store.
2. Configure model name if the default is not desired.
3. Configure AI flags and monthly limits only on Berkembang and Unggulan.
4. Validate tenant RLS and quota behavior in staging with runtime credentials.
5. Confirm privacy notice and school data-processing approval before enabling AI for customer schools.
6. Monitor actual Gemini billing; token usage in the event table is telemetry, not a guaranteed currency-cost calculation.
