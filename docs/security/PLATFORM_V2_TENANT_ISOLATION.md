# KELAS+ Platform V2 — Tenant Isolation Contract

Status: foundation implemented for identity/session tables and append-only audit events. Tenant-owned academic endpoints remain blocked until the full tenant test matrix is implemented.

## Threat model

A signed-in user may belong to more than one school. A client may alter school IDs, object IDs, filters, request bodies, cached keys, or replay an old request after membership revocation. Authorization must not rely on hidden UI controls or a school ID supplied by the client.

## Required request flow

1. Authenticate the user and validate session status/expiry/revocation.
2. Resolve the requested active school from the user's active membership on the server.
3. Begin a database transaction.
4. Set the authenticated user and active school using transaction-local PostgreSQL settings (for example, set_config('app.current_user_id', ..., true) and set_config('app.current_school_id', ..., true)).
5. Perform tenant-scoped reads/writes inside that same transaction and connection.
6. Commit/rollback; transaction-local settings must not leak into a pooled connection.
7. Write audit events for privileged operations and sensitive changes.

Never use session-level SET for tenant context with pooled connections. Do not accept an arbitrary school ID as authorization proof.

## Authentication boundary

- Browser cookie-authenticated mutations require an explicit `Origin` header matching the configured `CORS_ORIGINS` allowlist. Missing and untrusted origins are rejected.
- Do not weaken this check to accommodate native clients. A dedicated mobile authentication flow (short-lived access token plus revocable refresh/session credential, secure device storage, rotation and revocation) must be designed and tested separately before Flutter clients are connected.
- Session cookies are HttpOnly, SameSite=Lax, scoped to `/api/v1/auth`, and Secure in production. Production deployment must configure HTTPS and an exact origin allowlist; wildcard origins are not acceptable.
- Login failure counters must be updated atomically in the database to prevent concurrent requests from bypassing account lockout.

## RLS policy requirements

- Tenant-owned tables must enable and FORCE ROW LEVEL SECURITY.
- Policies must use NULL-safe context retrieval and deny access when context is absent or invalid.
- Runtime database role must be a dedicated non-owner role with no SUPERUSER and no BYPASSRLS.
- Migration role is separate and must never be used by the API runtime.
- Do not grant direct database access to web/mobile clients.
- Any cross-tenant platform support action must use a separate, narrow, audited workflow; it must not silently disable RLS.
- Tables with references between tenant-owned records must use tenant-aware constraints so a record from school A cannot point to a record from school B.
- Audit events are append-only for the runtime role: insert is actor-scoped (or anonymous intake only when no actor context exists), while runtime reads, updates, and deletes are denied. A separately reviewed privileged audit-reader workflow is required.

## Test matrix required before tenant endpoints

For at least two synthetic schools (A and B), test:
- No tenant context returns no tenant rows and rejects writes.
- Context A can read/write A records.
- Context A cannot read, update, or delete B records even when the B UUID is supplied directly.
- Context B cannot access A records.
- Missing/expired/revoked membership prevents context establishment.
- Pooled connection reused after transaction A does not retain tenant A context.
- Cross-school foreign-key references are rejected.
- Runtime role cannot bypass RLS; migration role is not configured in the application.
- Background jobs and exports carry and revalidate tenant context.
- Tests run against disposable PostgreSQL in CI, never a shared or production database.

## Safe implementation sequence

1. Commit schema migrations.
2. Create dedicated local/test runtime and migration roles in an isolated test database.
3. Add SQL RLS policies and integration tests using the runtime role.
4. Verify Prisma transactions and transaction-local context with connection pooling.
5. Finish membership resolution and active-school context establishment.
6. Only then implement tenant-owned academic data modules.

No production database, credentials, deployment, or student data is used by this document.

## School discovery boundary

- The authenticated `GET /api/v1/auth/schools` endpoint lists only active schools linked to the current identity.
- Membership discovery is allowed without an active-school context only for rows whose `user_id` matches the authenticated user context. This is a read-only exception to support school selection; membership writes still require an explicit active-school context and remain subject to the stricter existing policy.
- Each school record is fetched after setting its candidate school context transaction-locally, so the schools RLS policy remains in force. The client cannot use a submitted school ID as proof of membership.
- This endpoint does not yet establish a persistent active-school session or authorize academic operations. Tenant-owned modules must independently resolve and validate active membership within each request/transaction.

## Active school session boundary

- The authenticated `POST /api/v1/auth/select-school` endpoint accepts a school UUID only as a selector. The service rechecks that the authenticated identity has a membership and that the school is ACTIVE before saving the choice on that session.
- Active school is stored per session, not as a global user preference, so different sessions/devices may choose different schools.
- Session transactions initialize `app.current_school_id` from the session's active school or an empty value. Selection replaces it transaction-locally only after membership validation.
- School selection is audited as `auth.school_selected`. A failed membership or inactive-school check must not update the session.
- This is groundwork for tenant-aware requests, not a replacement for per-request authorization. Each future academic service must still validate membership and perform tenant queries inside one transaction with user and school context set.

## Platform registration review boundary

- Public registration intake is write-only under RLS: it may insert a request in `PENDING` state but cannot query the global registration queue.
- `GET /api/v1/schools/admin/registration-requests` and `POST /api/v1/schools/admin/registration-requests/:id/reject` require both a valid session and an exact email match in `PLATFORM_ADMIN_EMAILS` (comma-separated, normalized email addresses).
- The API sets `app.is_platform_admin` transaction-locally only after the application guard has authorized the request. Registration queue reads and updates are denied without that context.
- Rejection requires a reason, is allowed only while the request is `PENDING`, and writes an audit event in the same transaction.
- This first review increment deliberately does not provision or activate a school and does not create an account. Approval/provisioning requires a separate reviewed workflow, verified contact ownership, duplicate-email handling, and narrowly scoped provisioning policies.
- Before deployment, configure `PLATFORM_ADMIN_EMAILS` with verified administrator identities and provision a least-privilege runtime database role with the required table grants. Do not reuse a migration or database-owner role for runtime traffic.