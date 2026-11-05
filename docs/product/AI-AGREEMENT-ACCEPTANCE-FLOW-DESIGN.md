# KELAS+ — AI Agreement & Privacy Notice Acceptance Flow

Status: Stage 2 product/engineering design only — not implemented and not a legal determination.
Version: 0.1
Target branch: `feat/ai-privacy-audit-stage-2`

## 1. Purpose and non-negotiable distinction

This flow records that an authenticated user has received and acknowledged the applicable KELAS+ agreement and AI privacy notice versions before using the relevant AI capability.

**Acceptance of platform terms, acknowledgement of a privacy notice, school authorization, and consent where legally required are distinct concepts.** A single checkbox must not be treated as proof that every processing activity has a valid legal basis. The legal/privacy reviewer and school authority must determine which action is required for each purpose and data-subject category, including children.

This design does not decide the lawful basis, does not replace a school data-processing agreement, and does not authorize processing merely because a user clicked a button.

## 2. Scope and actors

- **Platform Admin / document publisher:** publishes a reviewed document version with effective date and change classification.
- **School authority / School Admin:** confirms the school's authority, user roster, and any school-level authorization required by the final agreement. School Admin cannot accept on behalf of a parent/guardian or individual user unless a documented authority permits it.
- **Teacher / School Leader:** receives the applicable notice and records their own acknowledgement/acceptance as required by the final policy.
- **Parent/guardian or other data subject:** handled through a separately designed and verified process when required. This design does not assume a teacher's click substitutes for their action.
- **KELAS+ service:** enforces capability gates server-side and records minimal evidence.

## 3. Document registry

Each published document version should have immutable metadata:

| Field | Purpose |
|---|---|
| documentKey | Stable key, e.g. `USER_DATA_AGREEMENT` or `AI_PRIVACY_NOTICE` |
| version | Immutable version identifier |
| title | User-facing document title |
| locale | Document language |
| contentReference | Published content location or immutable content hash |
| contentHash | Integrity check for the exact content shown |
| status | DRAFT, IN_REVIEW, APPROVED, PUBLISHED, SUPERSEDED, WITHDRAWN |
| effectiveAt | Effective timestamp |
| changeClass | MINOR_CLARIFICATION or MATERIAL_CHANGE |
| approvedBy / approvedAt | Authorized approval evidence |
| legalReviewReference | Reference to review evidence; no privileged legal advice text in ordinary user logs |

Published versions must never be edited in place. A correction creates a new version and preserves the previous record for audit.

## 4. User acceptance / acknowledgement record

Proposed record fields:

- id
- userId
- schoolId when acceptance is school-scoped
- documentKey
- documentVersion
- contentHash
- action: ACCEPTED, ACKNOWLEDGED, or DECLINED
- actedAt
- captureMethod (web, mobile, or authorized assisted process)
- locale
- requestId
- optional policy/legal basis reference approved by counsel

Do not store IP address or user-agent in this table by default; if security/legal review determines they are necessary, define purpose, access, and retention separately. Never store student profile data, prompt text, or AI content in acceptance records.

Uniqueness/idempotency should prevent duplicate active acceptance for the same user, school scope, document key, and version while preserving historical actions. Declining must remain an auditable action and must not be rewritten as acceptance.

## 5. User journey

1. User signs in and the server resolves the active user, membership, school, role, and permitted capabilities.
2. Before an AI capability is made available, the API checks the required currently published document versions and any required school-level authorization.
3. If an acknowledgement is missing, the UI presents the exact published document version and its effective date. The content hash is bound to the version displayed.
4. The user can open/read the full document and choose the action explicitly required by the approved policy. Do not pre-check the control or combine multiple documents into an ambiguous checkbox.
5. The API validates the action and records the document key, immutable version, content hash, user, school scope, timestamp, and request ID.
6. The server re-checks the acceptance record on every protected AI request. Hiding a button in the UI is not an authorization control.
7. If the user declines or required acknowledgement is absent, the relevant AI capability remains unavailable. Other non-AI school features remain available unless a separately approved policy says otherwise.
8. The UI explains why access is blocked and provides a route to view the document or contact the school/platform administrator.

## 6. Version changes and re-acceptance

- A minor clarification may require notice only, if approved by legal/privacy reviewer.
- A material change to purposes, data categories, AI provider, processing location, recipients, retention, user rights, or school responsibilities must trigger a documented impact review.
- Re-acceptance is required only where the approved legal/product policy determines it is necessary. Do not assume every text edit requires consent, or that a new click cures an invalid legal basis.
- The service must not silently carry an old acceptance forward to a materially different version.
- Keep historical acceptance evidence and associate each action with the exact content hash shown.

## 7. Server-side enforcement

Proposed enforcement contract:

- The AI capability endpoint resolves the active school membership and the applicable published document versions.
- It checks required user-level acknowledgements/acceptances and school-level authorization records independently.
- It fails closed for the gated AI capability if required evidence is missing, withdrawn, declined, invalid, or mismatched to the current version.
- Return a stable machine-readable error code such as `AI_POLICY_ACKNOWLEDGEMENT_REQUIRED` with document keys and versions, but no personal data beyond what the authenticated user needs to act.
- Re-check server-side immediately before provider invocation; never trust a client-supplied `accepted=true`.
- Existing role, entitlement, quota, tenant isolation, and student assignment checks remain mandatory and independent of this gate.

No endpoint, database schema, or UI is implemented by this document.

## 8. Audit and privacy requirements

- Record publication/approval and acceptance/decline events.
- Audit metadata should include document key/version, content hash, actor, school scope where relevant, action, and timestamp.
- Do not place document body, student identifiers, AI prompts, AI responses, passwords, tokens, or provider payloads in audit metadata.
- Acceptance evidence is itself personal data; restrict access and include it in the approved retention schedule.
- Avoid using acceptance records for unrelated analytics or profiling.
- Define access, correction, export, and deletion handling consistent with the final legal policy and any required evidence-preservation exception.

## 9. UX requirements

- Clearly distinguish “Saya telah membaca dan memahami pemberitahuan privasi” (acknowledgement) from “Saya menyetujui …” (acceptance/consent), and use only wording approved by counsel.
- Show document title, version, effective date, and last material change.
- Provide readable full text and a printable/downloadable copy.
- No preselected checkbox, dark pattern, or bundled acceptance for unrelated purposes.
- Do not imply that declining removes access to unrelated school records or non-AI modules.
- Provide an accessible mobile layout and a clear status indicator for each required document.
- For school-level authorization, show the authorized school representative and supporting reference where appropriate; do not expose confidential legal documents to every teacher by default.

## 10. Required tests

- Missing, declined, expired/superseded, and mismatched-version records block only the gated AI capability.
- Acknowledgement for one document does not satisfy another document.
- Acceptance in one school does not satisfy another school's requirement unless policy explicitly says it is platform-wide.
- A teacher cannot submit acceptance for another user.
- A School Admin cannot impersonate parent/guardian acceptance.
- Client-side forged acceptance flags are ignored.
- Material document version change triggers the configured re-acceptance/notice behavior.
- Repeated requests are idempotent and do not create inconsistent duplicate current records.
- Tenant isolation applies to reads and writes.
- Audit failure behavior is defined and tested without exposing database details.
- Desktop/mobile, keyboard, screen-reader labels, and document rendering are verified in staging.

## 11. Decisions still required before implementation

- Which documents are legally agreements, privacy notices, or operational acknowledgements.
- The lawful basis and responsible party per purpose and category, including children's data.
- Whether the school, platform operator, or both must sign/approve each document.
- Whether a guardian workflow is required, and how identity/authority is verified.
- Which changes are material and which require renewed acceptance.
- Acceptance evidence retention duration and deletion exceptions.
- Exact published content, operator identity, provider/subprocessor disclosures, processing locations, and contact channels.
- Whether the gate applies to all AI features or only AI case analysis; determine by purpose and data category.

## 12. Release boundary

This is a design artifact only. It does not implement consent collection, acceptance storage, API guards, UI, legal basis, or provider disclosure. Do not activate production AI based solely on this design. Implementation may begin only after the required legal/privacy, school-authority, provider, retention, security, and staging approvals are recorded.
