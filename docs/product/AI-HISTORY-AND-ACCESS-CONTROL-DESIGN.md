# KELAS+ — AI History & Access Control Design

> **Status:** Design proposal only. No database migration, API endpoint, response persistence, retention job, or production behavior is changed by this document.
>
> **Version:** 0.2  
> **Date:** 5 November 2026  
> **Target branch:** `feat/ai-privacy-audit-stage-2`

## 1. Purpose and implementation boundary

This design specifies how KELAS+ may later provide a private history of AI-assisted student case analyses while preserving tenant isolation, current role authorization, auditability, and human oversight.

**Current implementation facts**
- The AI API currently returns generated answers to the requesting user.
- `AiUsageEvent` stores usage metadata such as school, user, capability, model, status, token counts, and timestamp.
- Audit events record request and generation lifecycle metadata using a random case reference and allowlisted categories.
- The current schema does not provide a dedicated AI case-history record or persisted AI response.
- There are no history list/detail endpoints or retention purge jobs.

This proposal must not be described as an already available feature. It is a design gate for a later implementation PR.

## 2. Product principles

1. **Tenant isolation:** every history record belongs to exactly one school.
2. **Current authorization:** access is checked against current membership, active staff profile, current enrollment, and current teaching assignment/homeroom scope on every read. Being the original requester alone does not grant permanent access.
3. **Least privilege:** access to aggregate school insights does not grant access to individual student case histories.
4. **Human responsibility:** history is a record of AI assistance, not an official student record or an automated decision.
5. **Data minimization:** persist only what is necessary to support review and continuity.
6. **Auditable access:** successful and denied access attempts should be recorded without copying student identity or response content into audit metadata.
7. **Policy before persistence:** no history storage or purge activation until retention, deletion, provider, and legal/privacy decisions are approved.

## 3. Proposed data model (not implemented)

A future `AiCaseHistory` record may contain:

| Field | Purpose | Notes |
|---|---|---|
| `id` | Random primary key | UUID; never expose student identifier |
| `schoolId` | Tenant boundary | Required; indexed |
| `studentId` | Internal relation to student | Stored only inside KELAS+; never sent to provider |
| `classId` | Class scope at analysis time | For traceability; does not replace current authorization |
| `requestedByUserId` | Initiating user | Internal FK |
| `aiUsageEventId` | Usage linkage | Unique relation where appropriate |
| `caseReference` | Random external-safe reference | Unique; no embedded student data |
| `model` / `policyVersion` | Provenance | Record model and prompt/policy version |
| `assessmentScope` | Scope of academic records | Assigned subjects or homeroom class scope |
| `status` | Lifecycle | PENDING, SUCCEEDED, FAILED, AUDIT_FAILED, DELETION_PENDING, DELETED |
| `answer` | AI result | Sensitive education-related content; protect access and storage |
| `sanitizedQuestion` | Optional review context | Store only if approved and necessary; never raw unsanitized input |
| `createdAt`, `updatedAt` | Lifecycle timestamps | UTC |
| `expiresAt` | Approved retention boundary | Must not be populated with an invented/default period |

The exact schema, relation deletion behavior, indexes, database constraints, encryption design, and migration require a separate implementation review.

### Data that should not be persisted by default
- raw provider request/response payloads;
- raw unsanitized user prompt;
- student name, NISN, phone, email, address, date of birth, guardian details, or family profile in AI history metadata;
- provider credentials, secrets, or internal stack traces;
- copied source records that can be re-read from the authorized school record.

The internal student relation is needed to authorize the teacher's history view, but it must remain server-side and must not be included in provider payloads, URLs, analytics, or audit metadata.

## 4. Access policy

Authorization must be evaluated by the API for every list and detail request. Frontend hiding is not a security control.

### Teacher
A teacher may access a case history only when:
- the teacher has an active membership with role `TEACHER` in the active school;
- the teacher has an active staff profile;
- the student remains actively enrolled in the relevant active class; and
- the teacher currently has an active teaching assignment for that class, or is its current homeroom teacher.

The approved initial product decision is: **only the teacher who initiated an analysis may view that analysis history**. No other teacher, even one who currently teaches the same class or is its current homeroom teacher, may view that history. The initiating teacher must still pass all current authorization checks on every read: active membership, active staff profile, active student enrollment/class, and a current teaching assignment or homeroom relationship for that class. Creator identity alone does not preserve access after assignment or role revocation. No sharing or transfer of history is included in the first release.

### School Leader and School Admin
- May continue to access aggregate school insights according to existing entitlements.
- Do not receive individual case-history access by implication.
- Any future individual access must be a separate permission, justified purpose, audit requirement, and tested role-policy change.

### Platform Admin and School Operator
- No routine access to individual AI case history.
- Exceptional support access, if ever required, must be time-bound, purpose-limited, approved, visible to the school where appropriate, and audited. This is not part of the initial scope.

### Revocation and changed assignments
- Removing the initiating teacher's assignment or homeroom relationship revokes that teacher's access to the history for that class.
- A different teacher who later receives the class or homeroom assignment does not inherit access to histories created by the previous teacher.
- Another teacher's current assignment does not grant access to a history created by someone else.
- Disabling membership, staff profile, student, enrollment, or class blocks access.
- Changing the active school must never permit cross-tenant lookup.
- A history record's original class reference is traceability only; it cannot override current authorization.

## 5. Proposed API surface (not implemented)

Possible endpoints:

- `GET /ai/teacher/student-case-history?studentId=...`
  - Paginated list for one student, scoped by current teacher authorization.
- `GET /ai/teacher/student-case-history/:historyId`
  - Detail view after resolving the record and rechecking current authorization.

Requirements:
- Session authentication and active school are mandatory.
- Use opaque cursor pagination; enforce a small server-side page-size maximum.
- Never accept `schoolId`, `teacherId`, or authorization scope from the client as trusted input.
- Query by both history ID and active school, then verify current membership and student/class assignment before returning content.
- Use consistent not-found/forbidden behavior that does not reveal another tenant's record existence.
- Return only fields required by the UI; do not return internal student IDs, provider payloads, or audit internals.
- Add rate limits and abuse monitoring.
- No edit, regenerate, share, export, or delete endpoint is included in the first scope.

## 6. Audit model

Proposed events:
- `AI_CASE_HISTORY_LIST_VIEWED`
- `AI_CASE_HISTORY_DETAIL_VIEWED`
- `AI_CASE_HISTORY_ACCESS_DENIED`
- `AI_CASE_HISTORY_DELETION_REQUESTED`
- `AI_CASE_HISTORY_DELETED`

Audit metadata should use an opaque history/case reference, action, outcome, policy version, and minimal request context. Do not include student ID, student name, prompt, answer text, or source academic values.

Audit write failure policy must be explicit. For sensitive detail reads, decide whether to fail closed when an audit event cannot be persisted; tests must cover that behavior. Denied attempts must not leak whether a record exists in another tenant.

## 7. Retention, deletion, and legal holds

No retention duration is proposed here. The duration must be approved by product owner, school stakeholders, and legal/privacy review before the schema is migrated or any deletion job is enabled.

Before implementation:
- define separate retention rules for AI history, usage events, audit events, provider-side data, and backups;
- determine whether the school or platform can request deletion and who authorizes it;
- define legal hold and incident-investigation exceptions;
- specify export/return behavior at school contract termination;
- define backup expiry and provider deletion limitations;
- implement a dry-run report, bounded tenant-aware batches, idempotency, and a minimal deletion audit trail;
- test that deletion in one school cannot affect another school's records.

Do not cascade-delete official attendance, assessment, or student source records when deleting AI history.

## 8. UI behavior proposal

### Teacher view
- Add an **Riwayat Analisis AI** section within the authorized student context.
- Show date/time, short neutral title, status, model/policy provenance if useful, and initiating teacher.
- Detail page separates:
  1. data observations;
  2. hypotheses requiring teacher verification;
  3. suggested supportive actions;
  4. monitoring indicators and review timeframe;
  5. missing or incomplete data warnings.
- Clearly label the result as AI-generated support, not an official student record.
- Do not show sensitive content in notifications, browser page titles, or URL query strings.

### School leadership view
- No individual case-history UI in the initial scope.
- Continue aggregate insight workflows only.

### Empty, unavailable, and revoked states
- Explain when no history exists.
- If authorization has been revoked, do not show stale cached history.
- Do not store sensitive history in long-lived browser storage or service-worker caches.
- Ensure logout and active-school switch clear in-memory history state.

## 9. Security and test matrix

A later implementation must test at least:

| Scenario | Expected result |
|---|---|
| Teacher reads own case in currently assigned class | Allow |
| Teacher reads case in current homeroom class | Allow |
| Teacher reads another teacher's case (default policy) | Deny |
| Assignment removed after analysis | Deny |
| Homeroom changed after analysis | Deny for former homeroom teacher |
| Student enrollment inactive | Deny |
| Student or class belongs to another school | Deny without existence disclosure |
| Active school switched | Only active tenant records are visible |
| School leader requests individual case history | Deny unless separate explicit permission is approved |
| School operator/platform admin requests history | Deny by default |
| Malformed or guessed history UUID | Safe denial/not found |
| Audit write fails on detail read | Follow approved fail-closed policy |
| Pagination cursor tampered | Reject safely |
| History expired under approved policy | Not available; deletion event retained as permitted |
| Delete history | Does not delete academic source records |

Also test SQL/RLS tenant isolation, authorization race conditions, audit metadata allowlists, API response shape, rate limiting, and UI cache clearing.

## 10. Implementation sequence and release gates

1. Approve the product access matrix, especially whether history is visible only to its initiating teacher.
2. Approve retention duration, legal basis, school contract language, provider terms, and deletion procedure.
3. Review proposed Prisma model, RLS policy, indexes, and encryption requirements.
4. Implement schema and migration in an isolated feature branch.
5. Implement server-side list/detail endpoints and audit events.
6. Add authorization and tenant-isolation tests, including assignment revocation.
7. Implement teacher UI and verify mobile/desktop behavior.
8. Run synthetic-data staging tests and security review.
9. Obtain explicit release approval before merge or production deployment.

## 11. Decisions required before implementation

- [x] **Access is limited to the initiating teacher only**, subject to current authorization checks. Other teachers cannot view the history, even if they currently teach the class.
- [x] **A new homeroom teacher does not inherit prior histories.**
- [ ] What is the approved retention duration for AI case history?
- [ ] Can a school administrator request deletion, and what authorization is required?
- [ ] Is the AI answer stored as plain text protected by database/storage encryption, or is application-level encryption required?
- [ ] Which provider retention and deletion commitments are contractually verified?
- [ ] What is the approved audit failure behavior for history reads?

Until these decisions are approved, keep this as a design document and do not persist AI response content.
