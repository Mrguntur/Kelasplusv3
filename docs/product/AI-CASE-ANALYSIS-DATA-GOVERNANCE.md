# KELAS+ — AI Case Analysis & User Data Governance

Status: implementation specification and agreement outline (not a final legal agreement).
Owner: KELAS+ Platform
Target branch: `feat/ai-privacy-audit-stage-2`

## 1. Product decision

KELAS+ AI must be able to provide contextual teaching and school-management recommendations using real KELAS+ records. Privacy controls must protect people without reducing the feature to a generic chatbot.

Two AI workflows are intended:

1. **General consultation** — uses role-scoped aggregate context and the user's question.
2. **Student case analysis** — a teacher selects a student from a record they are already authorized to access. KELAS+ retrieves only the minimum relevant records on the server, creates a pseudonymous case snapshot, and sends that minimized snapshot to the configured AI provider. The provider must not receive the student's name, NISN, contact details, address, account identifiers, or internal student ID.

The platform keeps the mapping between the student record and the case session inside KELAS+. The AI response is linked to the case inside the authenticated platform, not by exposing the student's identity to the provider.

## 2. Authorization and data minimization

### Teacher
- Must have an active school membership and active staff profile.
- May analyze only a student currently enrolled in a class assigned to that teacher or a class for which the teacher is the homeroom teacher.
- The server must verify school, enrollment, assignment/homeroom relationship, and active status on every request. Never trust a student ID or class ID supplied by the browser by itself.
- Only use records within the teacher's permitted scope.

### School Leader and School Admin
- May use school-level aggregate insights according to existing AI entitlements.
- Individual case access is not implied by school-wide aggregate access. If individual case analysis is later granted to these roles, it must be an explicit product/permission decision and tested separately.

### School Operator and other roles
- No AI case access unless explicitly granted by a server-side entitlement and role policy.

### Provider payload
- Use a random per-request case reference (not a student ID).
- Exclude name, preferred name, NISN/student number, phone, email, address, date of birth, parent/guardian identity, and direct account identifiers.
- Exclude free-text notes by default. If a future workflow needs notes, apply a dedicated minimization and PII review step; do not assume regex redaction makes free text anonymous.
- Prefer time windows, counts, normalized assessment trends, attendance trends, and concise non-identifying educational context.
- Apply small-group safeguards: do not expose granular breakdowns that could identify a student in a very small cohort.
- Do not log provider prompts or raw student records in application logs, usage events, analytics, or error traces.

## 3. Student case analysis workflow

1. Teacher opens an existing student record and chooses **Analisis Kasus dengan AI**.
2. API authenticates the session, resolves active school membership, and verifies teacher assignment/homeroom scope server-side.
3. API fetches only necessary records: attendance trend, published assessment trend, and explicitly approved academic indicators. Do not fetch unrelated profile fields.
4. API transforms records into a minimized snapshot and replaces identity with a random case reference.
5. API sends the minimized snapshot and teacher's question to the configured provider.
6. AI returns: observed facts, possible explanations clearly marked as hypotheses, questions for human verification, short-term interventions, monitoring indicators, and review timeframe.
7. KELAS+ displays the result in the teacher's authenticated workspace and links it to the internal student record. The provider receives no identity mapping.
8. Teacher reviews and decides whether to use the recommendations. AI must never automatically change grades, attendance, student status, disciplinary outcomes, or official records.

## 4. AI behavior and safeguards

- Do not diagnose medical, psychological, developmental, or disability conditions.
- Do not label a student as lazy, problematic, incapable, or similar.
- Do not infer causes from correlation alone.
- Separate database facts, hypotheses requiring verification, and suggested actions.
- State missing, stale, incomplete, or low-confidence data.
- Avoid deterministic predictions about an individual student's future.
- Recommend supportive, proportionate, educational interventions and a human follow-up.
- Keep a human educator responsible for all decisions.
- Enforce plan capability and monthly quota on the server, not only in the UI.

## 5. Security, audit, and retention requirements

- Use tenant-scoped database transactions and existing row-level security context.
- Record audit events for authorized case-analysis requests and generation completion/failure, including actor, school, random case reference, timestamp, capability, outcome, assessment scope, data-category allowlist/exclusion list, and policy version. Do not store raw prompt, student ID, or student identity in audit metadata.
- Define retention and deletion behavior for AI case history before release; make retention configurable only through an explicit product policy.
- Protect case history with the same tenant and role authorization as the underlying student record.
- Do not use school/student records to train provider models unless a separate, explicit, informed agreement and legally reviewed basis exists.
- Document provider, model, processing region (if known), transfer mechanism (if applicable), subprocessors, and provider retention settings before enabling production traffic.
- Add rate limits and abuse controls for case analysis.

## 6. User Data Use Agreement — required sections

A user-facing agreement and privacy notice must be prepared before production release. This file is an outline, not legal advice or a final contract. Obtain qualified Indonesian legal/privacy review before publication.

1. Identity of the platform operator and contact channel.
2. Scope: platform account data, school operational data, teacher/staff data, student data, guardian data, logs, and AI interactions.
3. Purposes and lawful basis for each data category and processing activity.
4. Roles and responsibilities of the platform operator, subscribing school, school administrators, teachers, and other authorized users.
5. Data minimization, accuracy, access control, tenant isolation, encryption, backups, and security incident handling.
6. AI disclosure: which features use AI, what data categories are processed, what is sent to external AI providers, and what is deliberately excluded.
7. Provider/subprocessor identity, model, processing location, international transfer details where applicable, retention/deletion terms, and contractual safeguards.
8. Prohibition on using personal student data for provider model training without a separate valid and explicit arrangement.
9. Retention periods, deletion, account closure, school subscription termination, backup expiry, and legal hold exceptions.
10. User rights and request channels, including access, correction, deletion where applicable, objection/withdrawal where applicable, and complaint handling.
11. Consent/authorization flow where required, including the school's authority to submit student data and guardian/parent involvement where applicable.
12. Rules for acceptable use, prohibited uploads, credential security, and consequences of misuse.
13. Data breach notification and incident response.
14. Changes to the agreement, version history, effective date, and renewed acceptance.
15. Separate school subscription/data-processing terms and a data processing agreement where appropriate.

Do not represent acceptance of general platform terms as a substitute for any separate consent or authorization required for a specific processing purpose.

## 7. Release acceptance criteria

- [ ] Teacher cannot analyze a student outside assigned/homeroom classes (including cross-tenant IDs).
- [ ] SCHOOL_OPERATOR and unentitled roles receive 403 from case-analysis endpoints.
- [ ] Provider payload contains no direct student identifiers or internal student ID.
- [ ] Tests verify minimization and role/scope denial paths.
- [ ] AI case output distinguishes facts, hypotheses, and recommendations.
- [ ] AI cannot execute mutations to academic records.
- [ ] Case history is tenant-scoped and access-controlled.
- [ ] Audit events contain no raw student personal data or prompt text.
- [ ] UI explains AI processing and links to the current privacy notice/agreement.
- [ ] User Data Use Agreement and provider/subprocessor disclosures have been reviewed and approved before production.
- [ ] API unit, integration, authorization, RLS, and end-to-end tests pass.
- [ ] Manual desktop/mobile and staging verification pass.

## 8. Current implementation status

- Stage 1: authorization and subject-scope hardening, service tests, and Web/API CI completed on the feature PR.
- Stage 2 implementation: audit events are recorded for authorized case-analysis requests and generation completion/failure. Audit metadata uses a random case reference and policy/data-category metadata; it does not include the prompt or student ID.
- Student-case usage status and completion/failure audit event are persisted in the same database transaction. If audit persistence fails, the API does not report a successful result; it attempts a safe failure transition and returns a generic unavailable response if audit persistence remains unavailable.
- Unit tests cover successful and provider-failed generation, event ordering, outcome/status metadata, identity exclusion, and audit persistence failure paths. CI runs #642–#647 passed on the Stage 2 branch.
- A separate AI retention/deletion proposal now documents data categories, required policy decisions, deletion workflow, and release gates. It is a design proposal only: no retention duration or automatic purge is active.
- The free-text question redaction covers common email/phone patterns and numeric identity-like sequences of 8–18 digits, in addition to the selected student's full/preferred name. This is a defense-in-depth filter, not proof of complete anonymization or detection of every person's name.
- Provider-payload fixture tests and service-level audit lifecycle tests have passed CI. Staging verification, approval and implementation of retention/deletion controls, agreement acceptance, and provider/legal review remain release gates until all checks and reviews are complete.

This specification records the agreed product direction. It does not claim that the agreement acceptance flow, retention controls, or provider contract safeguards are implemented. These must be delivered and tested before production release.

## Draft dokumen privasi dan perjanjian pengguna

Dua rancangan berbahasa Indonesia ditambahkan untuk review internal:

- `docs/legal/USER-DATA-AGREEMENT-DRAFT-ID.md` — rancangan perjanjian penggunaan data antara penyelenggara dan sekolah.
- `docs/legal/AI-PRIVACY-NOTICE-DRAFT-ID.md` — rancangan pemberitahuan privasi dan penggunaan AI untuk pengguna.

Keduanya berstatus **DRAFT INTERNAL**, bukan dokumen yang telah disahkan atau siap diberlakukan. Dokumen menggunakan placeholder untuk identitas penyelenggara, kontak privasi, daftar penyedia, lokasi pemrosesan, dasar pemrosesan, retensi, dan prosedur hak subjek data. Semua klaim wajib dicocokkan dengan implementasi dan kontrak penyedia serta ditinjau penasihat hukum sebelum publikasi.

CI dokumentasi sebelumnya (#648 dan #649) telah lulus pada commit sebelumnya. Perubahan dokumen privasi ini memicu validasi CI baru; hasilnya harus diperiksa sebelum tahap ini dinyatakan selesai.

## AI History & Access Control

A separate design proposal has been added at `docs/product/AI-HISTORY-AND-ACCESS-CONTROL-DESIGN.md`.

The proposal documents the current implementation boundary (no persisted AI answer/history table or history endpoints), the proposed tenant-scoped history model, current-assignment authorization, role restrictions, audit events, UI behavior, security test matrix, and release gates. It intentionally does not introduce a migration, persist AI response content, or activate retention/deletion behavior. Product decisions and approved retention/provider/legal terms are required before implementation.

## Roadmap boundary and current stage

KELAS+ AI governance work remains in **Stage 2 — AI Privacy, Audit & Data Governance**.

- **Stage 1 — AI Security Hardening:** authorization, subject-scope controls, data minimization, and provider-payload safeguards. The corresponding feature-branch CI checks passed.
- **Stage 2 — AI Privacy, Audit & Data Governance:** audit lifecycle and failure handling, Indonesian user-data agreement draft, AI privacy notice draft, retention/deletion proposal, and AI History access-control design. CI runs #648–#654 passed for the documented changes up to the current feature-branch head.
- **Stage 3 — AI History Implementation:** a separate implementation phase for schema, tenant-scoped API, audit-on-read, and teacher UI. This phase has **not started**. No history table, history endpoint, or persisted AI answer exists in the current implementation.

### Approved Stage 2 product decision

The initial AI case-history access policy is **creator-only**: only the teacher who initiated an analysis may view it, and only while that teacher retains active membership, active staff profile, active enrollment/class, and current teaching or homeroom authorization. Other teachers, including a newly assigned teacher or homeroom teacher, do not inherit access.

### Remaining Stage 2 release gates

- [ ] Complete legal/privacy review and fill all placeholders in the user agreement and AI privacy notice.
- [ ] Verify provider/subprocessor contracts, processing locations, retention, model-training terms, and deletion commitments.
- [ ] Approve retention periods and deletion authority with school/product/legal stakeholders.
- [ ] Define and test the user agreement/privacy notice presentation and acceptance evidence.
- [ ] Complete synthetic-data staging, RLS/tenant-isolation, and desktop/mobile verification.

A green CI confirms automated checks only; it does not complete legal approval, provider due diligence, staging, or manual verification. Do not start Stage 3 persistence or enable production history until the required Stage 2 gates are approved.


## Stage 2 update — versioned agreement acceptance flow

A new design artifact is available at `docs/product/AI-AGREEMENT-ACCEPTANCE-FLOW-DESIGN.md`.

It specifies an immutable document-version registry, separate user acknowledgement/acceptance evidence, school-level authorization, version/content-hash binding, server-side AI capability gates, material-change handling, privacy-minimized audit records, UX safeguards, and required tests. It explicitly distinguishes acknowledgement of a privacy notice, contractual acceptance, school authorization, and consent where legally required.

This remains a design artifact. No acceptance table, endpoint, API guard, consent UI, or production gate has been implemented. The lawful basis, guardian/parent process, school authority, document wording, and retention of acceptance evidence remain subject to qualified Indonesian legal/privacy review and school approval.

### Stage 2 validation snapshot

- [x] CI #655 passed for the roadmap/stage-boundary documentation update.
- [x] CI #656 passed for the retention/deletion decision register.
- [x] Retention decision register RET-01–RET-10 added; all policy decisions remain Pending until supported by approvals/evidence.
- [x] Versioned agreement and privacy-notice acceptance flow design added.
- [ ] CI for the latest acceptance-flow documentation commit.
- [ ] Legal/privacy and school-authority approvals.
- [ ] Provider/subprocessor due diligence and verified contractual terms.
- [ ] Approved retention schedule and deletion authority.
- [ ] Implementation and staging verification of the approved acceptance and retention controls.
- [ ] Manual desktop/mobile, RLS, and tenant-isolation verification.

**Stage 2 is not complete yet.** The remaining items require decisions, evidence, and verification outside documentation-only CI. Do not mark these gates complete or start Stage 3 persistence until they are satisfied.
