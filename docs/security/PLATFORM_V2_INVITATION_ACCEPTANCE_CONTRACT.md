# KELAS+ Platform V2 — Administrator Invitation Acceptance Contract

Status: implementation contract; invitation creation and acceptance endpoints are not enabled by this document.

## Required lifecycle

1. A platform administrator may prepare an invitation only for a school whose registration was approved and whose school shell remains `PENDING`.
2. The invitation email must exactly match the contact email on the approved registration request. A platform administrator must not silently redirect an invitation to a different address.
3. Generate a cryptographically random token with at least 256 bits of entropy. Store only its SHA-256 digest; never return the raw token from an API, persist it, or include it in audit metadata or logs.
4. Deliver the token through a configured transactional email provider. Do not create a usable invitation if delivery fails. Provider credentials must be supplied by deployment environment secrets, not committed to Git.
5. Acceptance is a public, rate-limited endpoint. It must return a generic invalid/expired response for missing, unknown, expired, revoked, already accepted, or otherwise unusable tokens.
6. Acceptance must atomically claim the invitation only if it is unaccepted, unrevoked, and unexpired. Concurrent attempts must result in at most one success.
7. Normalize the invitation email to lowercase. Do not attach an existing account to a school automatically; duplicate email requires a separate authenticated, explicitly authorized membership workflow.
8. On successful claim, create a new user with an Argon2id password hash and active status, create exactly one `SCHOOL_ADMIN` membership, activate the school only after all required checks pass, and write the audit event in the same transaction.
9. Do not create a session as part of acceptance. The new administrator must log in through the normal authentication endpoint after account creation.
10. Do not expose invitation records to ordinary school users. The current invitation RLS policy intentionally allows only the platform-admin context. Acceptance must use a narrowly scoped database function or equally constrained server-side transaction; do not disable RLS or grant broad table access to anonymous clients.

## Required tests before enabling the routes

- Reject malformed input and rate-limit repeated token attempts.
- Unknown, expired, revoked, and already-accepted token are rejected with the same public error.
- Expired/revoked/accepted invitations cannot create users, memberships, or activate schools.
- A token for school A cannot create a membership in school B.
- Email mismatch and pre-existing email do not create a membership.
- Two concurrent accept requests produce one success at most.
- Raw tokens never appear in response bodies, logs, or audit metadata.
- The application runtime role cannot read the invitation table without the narrowly scoped acceptance mechanism.
- Test all behavior against a disposable PostgreSQL database using a non-owner, `NOBYPASSRLS` runtime role.

## Operational boundary

No invitation should be issued until delivery configuration, token acceptance, database access boundaries, and these tests are implemented. This work targets `feat/platform-v2-foundation` only. It does not authorize a production migration, deployment, or change to the existing YoHost/Firebase application.
