# KELAS+ Platform V2 — Target Architecture

Status: Proposed architecture / review required
Target: 100–1,000 schools, multi-tenant SaaS
Product: KELAS+ — Dari Data Menjadi Aksi
Scope: Web + Android + iOS; clean rebuild independent of the current YoHost/Firebase trial.

## 1. Core decisions

- Web: React + TypeScript + Vite, responsive and role-aware.
- Mobile: Flutter for Android and iOS.
- API: NestJS + TypeScript, modular monolith, REST/JSON under /api/v1.
- Database: PostgreSQL as the system of record; schema migrations, foreign keys, transactions, indexes, and Row-Level Security (RLS).
- Cache/queues: Redis-compatible service only for measured needs; never the source of truth.
- Files: private S3-compatible object storage for exports/imports/attachments, with short-lived signed URLs.
- Authentication: server-owned identity/session model, Argon2id password hashing, short-lived access credentials, rotating refresh sessions, secure web cookies, MFA for privileged roles, recovery and revocation workflows. Keep an interface for future OIDC/SSO.
- Deployment: containers in separate development, staging and production environments. Choose managed PostgreSQL or dedicated PostgreSQL after budget, region, support and operations are agreed.
- Operations: structured logs, metrics, error tracking, audit events, uptime checks, alerts and request correlation IDs.

PostgreSQL avoids per-document read/write billing quotas common to document databases. It is not unlimited: CPU, storage, connections, backups, network and hosting capacity still cost money and require monitoring.

## 2. System architecture

Clients: React web / Flutter Android-iOS
    -> HTTPS + WAF/TLS
    -> Stateless NestJS API (versioned REST)
         -> PostgreSQL primary (source of truth, private network)
         -> Redis (optional cache and queues)
         -> private object storage
    -> Background workers for PDF, Excel, imports, notifications and expensive jobs
PostgreSQL -> encrypted backups and tested restore process

All client writes go through the API. No database credentials are shipped to web or mobile clients. API authorization is the primary control; RLS is a second tenant-isolation boundary.

## 3. Multi-tenant isolation

Use a pooled shared PostgreSQL database with shared tables for the 100–1,000-school starting scale. Keep an upgrade path to dedicated database/schema isolation for large or contractually isolated tenants.

Rules:
1. Each school is a tenant. Tenant-owned records must carry a non-null school_id.
2. Derive active tenant context from a verified identity and active membership; never trust a client-provided school_id as proof of access.
3. Every tenant-scoped query and repository method requires tenant context.
4. Use tenant-aware foreign keys and unique constraints where needed to prevent cross-school relationships.
5. Enable and force RLS for tenant tables. Runtime DB roles must not be superusers, table owners or BYPASSRLS roles. Set tenant context transaction-locally and test pooled-connection reuse.
6. Cross-school platform administration is a separate, narrowly scoped and audited path.
7. Tenant scope must be present in cache keys, background jobs, exports, files, rate limits and security logs where relevant.
8. Add negative tests attempting cross-tenant reads/writes for every tenant-owned resource.

## 4. Roles and domain modules

Roles: PLATFORM_SUPER_ADMIN; SCHOOL_ADMIN; SCHOOL_LEADER; TEACHER; optional SCHOOL_OPERATOR with narrowly delegated permissions.

Use RBAC plus resource/relationship checks. A teacher role alone is not enough: validate assigned class, subject, academic year and school. Enforce permissions in domain services/repositories, not just UI visibility.

Start as a modular monolith rather than microservices to reduce operational complexity while preserving clear module boundaries:
- Identity & Sessions: accounts, credentials, MFA, recovery, sessions and revocation.
- Tenancy & Memberships: schools, invitations, membership and tenant lifecycle.
- School Structure: academic years/terms, classes, subjects, schedules and teacher assignments.
- Students: profiles, enrollments, history and validated imports.
- Attendance: sessions, records, corrections, offline sync and idempotency.
- Teaching Journal: lesson objectives, activities, reflection and attachments.
- Assessment & Learning Map: assessments, teacher-owned tasks, scores and progress.
- Reports & Exports: PDF/Excel generation, queued jobs and private temporary files.
- Notifications: in-app/email/push delivery and retry status.
- AI Assistant: provider abstraction, server-side keys, data minimization and audit.
- Platform Admin/Billing: tenant activation, plans and subscriptions if monetized.
- Audit & Compliance: privileged changes, exports, role changes and security events.

## 5. Initial relational model

Platform tables:
- schools(id, slug, name, status, timezone, locale, created_at, updated_at)
- users(id, email_normalized, phone, display_name, status, password_hash, created_at, updated_at)
- school_memberships(id, school_id, user_id, role, status, created_at), unique(school_id, user_id)
- sessions(id, user_id, token_hash, expires_at, revoked_at, last_seen_at, device_label, created_at)
- invitations(id, school_id, email_normalized, role, token_hash, expires_at, accepted_at, created_by)
- audit_events(id, school_id nullable, actor_user_id, action, resource_type, resource_id, request_id, redacted_metadata, created_at)

Academic tables:
- academic_years, terms, classes, subjects, teacher_assignments, students, enrollments, teaching_schedules
- attendance_sessions, attendance_records, teaching_journals
- assessments, assessment_scores, learning_tasks, student_notes
- import_jobs, export_jobs, notifications, idempotency_records and outbox_events where justified.

Every tenant-owned table needs documented school association, access policy, retention and indexes. Use migrations only; no ad-hoc production schema changes. Store timestamps in UTC and keep each school's timezone configurable. Avoid storing derived scores/statuses unless measurements justify caching and invalidation.

## 6. Authentication and application security

- Hash passwords with Argon2id using parameters calibrated to production hardware.
- Web: Secure + HttpOnly cookies, appropriate SameSite policy and CSRF protection for cookie-authenticated state changes.
- Mobile: short-lived access credentials; rotating refresh sessions stored in Android Keystore/iOS Keychain through a vetted plugin; revoke on logout, password reset or suspicious activity.
- Never store passwords or long-lived tokens in ordinary local preferences or ship secrets in the app bundle.
- Require MFA for platform super-admin; support/enforce MFA for school admins by policy.
- Rate-limit login, recovery, invitations and sensitive workflows; use generic authentication errors.
- Separate migration owner and runtime database roles; least privilege for all credentials.
- Parameterized SQL, strict input validation, output DTOs, request size limits, upload validation, CORS allowlist, TLS and security headers.
- Keep development, staging and production credentials, databases, storage and app identifiers separate.
- Run dependency, secret, SAST and container scans in CI; keep secrets in a secret manager/environment, never Git.

## 7. PostgreSQL performance and capacity

- Private DB network, TLS in transit and infrastructure encryption at rest.
- Index foreign keys and common access paths, typically tenant + academic year/class/date; validate using query plans.
- Paginate large lists, select only needed columns and avoid N+1 queries.
- Use a bounded connection pool; never open a new DB connection per request.
- Redis is optional and non-authoritative; use tenant-aware keys, bounded TTL and a documented invalidation strategy.
- Queue PDF/Excel generation, imports, notifications and heavy analytics.
- Monitor slow queries, pool saturation, CPU, memory, storage, locks, deadlocks and queue depth.
- Load-test expected peak concurrency and define response-time targets before launch.

## 8. Offline attendance

- Store a minimal pending queue protected by OS/device security; use UUID idempotency keys.
- Track client event time separately from server receipt time; server remains authoritative for policy and audit.
- Batch sync API returns per-record outcomes: accepted, duplicate, conflict or rejected with a stable reason.
- Never silently overwrite server data. Corrections require permission and an audit record.
- Validate membership, teacher assignment, enrollment, class, date and schedule on the server.
- Show pending/synced/conflict/rejected states; provide explicit retry and correction flows.
- Define retention and behavior when a user's access is revoked; clear sensitive local state on logout where appropriate.

## 9. API and data model rules

- Publish an OpenAPI contract for /api/v1.
- Consistent error format, request ID, allowlisted filters and cursor/page pagination.
- Idempotency for creates and offline sync; optimistic concurrency for edits.
- Never return database rows wholesale. Enforce resource-level authorization to prevent BOLA/IDOR.
- Rate-limit by IP, account, tenant and route; bound request bodies, uploads and job consumption.
- Keep audit logs for role changes, exports, attendance corrections, support access and session/security events.

## 10. Privacy, backups and operations

- Minimize student data; document classification, lawful basis/consent where applicable, retention, export/deletion and incident response.
- Redact student names, passwords, tokens and sensitive payloads from logs.
- AI is policy-controlled and server-side; minimize/pseudonymize student data sent to providers and never put provider keys in clients.
- Encrypted automated backups, point-in-time recovery if supported, separate backup access boundary and scheduled restore drills.
- Agree RPO/RTO before choosing hosting tier; a backup is not valid until restore is tested.
- Staging uses synthetic data, not production student records.
- Use health checks and rolling/blue-green deploys; apply expand-migrate-contract database migrations.

## 11. Proposed repository layout

apps/web/                 React + TypeScript
apps/mobile/              Flutter
services/api/             NestJS modular API
services/worker/          background jobs (may initially share packages with API)
packages/api-contracts/   OpenAPI-derived types and validation
packages/ui-web/          reusable web components
database/migrations/      versioned PostgreSQL migrations
database/seeds/           synthetic development data only
infra/                    containers, environments and monitoring
docs/architecture/        architecture decisions
docs/security/            threat model and security controls
docs/operations/          deployment, backup and incident runbooks

CI gates: formatting/lint/type checks; unit/integration tests; migrations against disposable PostgreSQL; RLS and cross-tenant denial tests; API contract tests; SAST/dependency/secret scanning; Flutter analyze/test/build; immutable artifacts; staging deployment only after approval.

## 12. Delivery phases

Phase 0: confirm business rules, data classification, threat model, roles, attendance policy, service objectives and hosting constraints.
Phase 1: repository, environments, CI, PostgreSQL, migrations, tenant isolation, identity/sessions, audit and API skeleton.
Phase 2: school onboarding, memberships, academic years, classes, subjects, assignments, students and imports.
Phase 3: attendance, teaching journals, assessments, Learning Map, exports and reports.
Phase 4: role-aware web and Flutter clients; secure auth; offline attendance sync.
Phase 5: load/security testing, restore drills, runbooks, support and operational alerts.
Phase 6: controlled pilot with a small number of consenting schools, then expand based on measured results.

## 13. Production acceptance gates

- Cross-tenant isolation tests pass for every tenant-owned table and endpoint.
- RLS policies, DB roles and authorization have independent review.
- Session revocation, MFA and account recovery tests pass.
- Backup restore is demonstrated; RPO/RTO are documented.
- Peak load test meets agreed SLOs without exhausting DB pool or resources.
- Privacy, retention, export and incident-response policies are documented.
- Android/iOS builds are reproducible and signing keys protected.
- No unresolved critical/high security findings.
- Monitoring and alerts are verified through an incident drill.

## 14. Decisions required before infrastructure selection

1. Monthly hosting budget and preferred region/data residency.
2. Managed PostgreSQL versus self-managed dedicated server; this determines operations burden, not whether SQL has per-document quotas.
3. Expected peak concurrent users per school and approximate total student records.
4. Login policy: email/password, email/OTP or institutional SSO.
5. Retention and school offboarding/export rules.
6. Availability target, RPO and RTO.
7. Whether subscription payments are in the first release.

This document does not change any production system, database, or deployment.