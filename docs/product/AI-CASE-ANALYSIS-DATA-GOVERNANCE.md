# KELAS+ — AI Case Analysis & User Data Governance

Status: implementation specification and agreement outline (not a final legal agreement).
Owner: KELAS+ Platform
Target branch: `feat/ai-case-analysis-data-governance`

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
- Stage 2 in progress: audit events are now recorded for authorized case-analysis requests and generation completion/failure. Audit metadata uses a random case reference and policy/data-category metadata; it does not include the prompt or student ID.
- The free-text question redaction now covers common email/phone patterns and numeric identity-like sequences of 8–18 digits, in addition to the selected student's full/preferred name. This is a defense-in-depth filter, not proof of complete anonymization or detection of every person's name.
- Provider-payload fixture tests, end-to-end audit assertions, staging verification, retention/deletion controls, agreement acceptance, and provider/legal review remain release gates.

This specification records the agreed product direction. It does not claim that the agreement acceptance flow, retention controls, or provider contract safeguards are implemented. These must be delivered and tested before production release.
