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
