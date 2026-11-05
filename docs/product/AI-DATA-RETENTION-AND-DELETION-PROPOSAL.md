# KELAS+ — AI Data Retention & Deletion Proposal

Status: design proposal only — no retention period or deletion job is active.
Owner: KELAS+ Platform
Applies to: AI usage events, AI case-analysis audit metadata, and future AI case history.

## 1. Design principles

1. Collect and retain only data required for service delivery, security, billing/quota, dispute handling, and legal obligations.
2. Keep academic source records separate from AI operational records. Deleting AI operational metadata must never delete attendance, assessments, journals, enrollment, or student profiles.
3. Do not persist provider prompts, full provider payloads, student names, student numbers, or AI response text in audit metadata.
4. Retention must be purpose-bound, documented, approved, and consistently enforced across primary databases, replicas, exports, and backups.
5. A deletion request must be authorized, auditable, tenant-scoped, and protected against cross-school access.
6. Legal hold, an active dispute, or a documented security investigation may suspend deletion for only the affected records and approved scope.
7. The platform must not claim that deletion is complete while copies remain in backups or provider systems.

## 2. Data inventory and proposed treatment

| Data category | Current purpose | Proposed treatment | Retention decision |
|---|---|---|---|
| AI usage events | Monthly quota, token accounting, service operations | Retain minimal fields: school, actor, capability, model, status, token counts, timestamp | Duration requires platform/legal approval |
| AI case audit events | Accountability, access/security review | Retain event type, actor, school, random case reference, outcome, policy version, allowed/excluded categories; no prompt or student ID | Duration requires platform/legal approval |
| AI prompts and provider payloads | Transient inference request | Do not persist in KELAS+ database or application logs | Not retained by KELAS+; provider terms must be verified |
| AI response text / case history | Not persisted by current student-case service | Do not introduce persistent history until access, purpose, retention, deletion, and school authorization are approved | Product decision required before implementation |
| Academic source records | Core school operations | Govern under the school's academic-record policy; AI retention must not alter these records | Outside this AI retention policy |
| Backups and replicas | Disaster recovery | Expire according to documented backup lifecycle; deletion propagates through expiry or controlled purge | Infrastructure policy required |

## 3. Required decisions before implementation

The platform owner and qualified Indonesian privacy/legal reviewer must approve:

- Retention period for AI usage events.
- Retention period for AI audit events and whether any minimal, non-identifying audit fields need a longer period.
- Whether schools can request early deletion of operational AI metadata and what exceptions apply.
- Whether any AI case history will be stored; if yes, which roles can access it and whether the school can configure retention.
- Backup expiry, point-in-time recovery, replica, export, and disaster-recovery deletion behavior.
- Provider retention settings, processing location, subprocessors, and provider-side deletion mechanism.
- Legal-hold approval, scope, owner, review date, and release process.
- User request verification and response workflow.

No arbitrary default duration is to be presented as a legal requirement. A duration must not be activated merely because it is technically convenient.

## 4. Deletion workflow requirements

When a retention schedule is approved, implement a controlled workflow:

1. Identify expired records using an approved retention policy version and timestamp.
2. Exclude records under an active, documented legal hold.
3. Run in dry-run mode first; report counts grouped by data category and school without exposing personal data.
4. Require a platform-level service identity or authorized platform administrator; never rely on a school user's arbitrary school ID.
5. Apply tenant-aware deletion in bounded batches and record a minimal deletion audit event.
6. Ensure deletion is idempotent and safe to retry.
7. Preserve only the minimal deletion evidence required to prove the action, without retaining the deleted personal data.
8. Verify affected row counts and ensure academic source records were not modified.
9. Record policy version, execution time, result, and failure category. Never log raw record contents.
10. Document backup expiry and provider-side deletion separately; do not claim immediate erasure from immutable backups.

## 5. Security and engineering acceptance criteria

- [ ] Retention policy has an approved version, owner, effective date, and review date.
- [ ] Each retained category has a documented purpose and retention duration.
- [ ] Dry-run report is available before destructive execution.
- [ ] Deletion is idempotent, bounded, observable, and safe to retry.
- [ ] Tenant boundaries are enforced by server-side policy and database controls.
- [ ] Legal holds are scoped, time-bound, and auditable.
- [ ] Deletion does not modify academic records or billing records.
- [ ] Audit metadata contains no raw prompt, student name, student ID, NISN, or provider payload.
- [ ] Backup, replica, export, and provider deletion behavior is documented.
- [ ] Automated tests cover tenant isolation, expiry boundary, legal hold, dry-run, retry, and failure handling.
- [ ] Staging test uses synthetic data and verifies exact deletion scope before production approval.

## 6. Current implementation boundary

- The current student-case flow sends a minimized snapshot to the configured provider and does not save the generated answer as a persistent case-history record.
- AI usage events store operational quota/token metadata.
- AI case audit events store pseudonymous case references and allowlist/denylist metadata.
- Student-case usage status and completion/failure audit event now share a database transaction.
- If completion audit persistence fails, the service attempts to mark the usage event failed and record a failure event. If that audit write also fails, the API returns a safe unavailable response and does not expose database details.
- No scheduled deletion, retention expiry field, retention period, or automatic purge is active.
- This proposal must be approved before implementing destructive retention jobs or exposing user-facing deletion claims.

## 7. Release gates

Do not enable production AI case analysis until the platform has:
- Approved retention and deletion policy.
- Reviewed provider retention and subprocessor terms.
- Implemented and tested the approved retention workflow.
- Published the user-facing data-use agreement and AI privacy notice.
- Verified tenant-scoped access and synthetic-data deletion in staging.
- Completed security and legal/privacy review.
