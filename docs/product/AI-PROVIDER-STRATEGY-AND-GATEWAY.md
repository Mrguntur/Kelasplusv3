# KELAS+ — AI Provider Strategy & Gateway Architecture

Status: product/engineering direction recorded from owner decision; implementation not started.
Target branch: `feat/ai-privacy-audit-stage-2`

## 1. Owner decision

- Gemini API Free is currently used with limited quota for development/testing.
- The intended production direction is a paid third-party AI API with more flexible model selection and higher available quota.
- KELAS+ must not become permanently coupled to Gemini or any single AI vendor.
- This document records the direction; it does not select a final provider, approve a contract, or authorize real student-data processing.

## 2. Provider gateway

All AI calls must pass through a server-side provider gateway owned by KELAS+:

`AI feature/controller -> authorization + entitlement + quota -> context minimization -> provider gateway -> provider adapter -> external API`

Responsibilities:
- Keep API keys only in backend secrets/configuration. Never expose provider keys to browser/mobile clients.
- Normalize request/response formats behind a stable internal interface.
- Apply role/tenant authorization and data minimization before routing.
- Apply per-school and platform budgets, token ceilings, rate limits, timeouts, retry policy, and usage metering.
- Allow an operator-controlled model/provider configuration without frontend changes.
- Log provider name, model, latency, token counts, status, and cost metadata where available; do not log raw prompts, student identities, or full provider payloads.
- Make provider switching explicit and auditable; never silently route student-case data to an unreviewed provider.
- Fail closed when a provider is not approved for the relevant data category or purpose.

## 3. Provider selection candidates

These are evaluation candidates, not endorsements or approved subprocessors:

| Candidate | Potential benefit | Key due diligence |
|---|---|---|
| Direct OpenAI API | Direct model access, documented API data controls | Endpoint-level retention, abuse-monitoring logs, regional/contract options, DPA and child-access suitability |
| Direct Anthropic API | Commercial API, documented default retention and optional ZDR arrangements | Exact feature eligibility, standard retention, ZDR approval, DPA, child-access suitability |
| OpenRouter or similar aggregator | One API surface and broad model choice/routing | Each underlying model provider's retention/training terms, routing path, DPA/subprocessor chain, provider allowlist and no-training controls |
| Google paid product (Gemini API Paid or Vertex AI) | Potential continuity with current integration | Identify exact product; verify billing, terms, DPA, region, age/education restrictions, abuse logging, and retention |

A marketplace/aggregator does not automatically provide one uniform privacy promise for all models. The selected underlying model provider and route must be allowlisted and reviewed.

## 4. Minimum approval checklist per provider/model

Before a provider/model can receive real school or student data, record:
- Legal entity and exact API product/endpoint.
- Contracting entity, DPA/data-processing terms, and subprocessor list.
- Whether inputs/outputs are used for model training or improvement, including feedback and abuse-review exceptions.
- Standard retention, abuse-monitoring retention, ZDR availability/eligibility, and deletion procedure.
- Processing region, international transfer mechanism, and support access locations.
- Age restrictions and suitability for an education service potentially accessed by minors.
- Security certifications and incident-notification terms relevant to the service.
- Model identity/version, data categories permitted, and approved KELAS+ use cases.
- Pricing unit, rate limits, quota, concurrency, context limits, and billing controls.
- Evidence URL/document, review date, reviewer, decision, and next review date.

A paid plan or high quota alone is not sufficient approval.

## 5. Routing policy

Initial proposal:
- Development/testing: Gemini Free only with synthetic/non-personal data and low-risk test prompts.
- Production general teacher/leadership assistance: only a provider/model explicitly approved for the relevant data categories and purpose.
- Student case analysis: stricter allowlist; no real student data until provider eligibility, DPA, retention, transfer, and school/legal approvals are complete.
- Fallback: only to another pre-approved provider/model with equivalent or stricter data controls. Never fall back to an arbitrary cheapest model.
- If no approved provider is available, return a safe unavailable response; do not downgrade privacy controls to preserve availability.

## 6. Cost and quota governance

The gateway should support:
- Platform-wide monthly budget and emergency kill switch.
- Per-school package quota and spend ceiling.
- Per-user rate limits and per-capability limits.
- Model routing by task class and approved quality/cost tier.
- Maximum input/output tokens and request timeout.
- Daily spend alerts and anomaly detection.
- Usage attribution by school, capability, provider, and model without raw content.
- No automatic overage charging unless the school's subscription terms explicitly authorize it.

## 7. Proposed configuration shape

Illustrative configuration only; not a committed runtime schema:

- `AI_DEFAULT_PROVIDER`
- `AI_DEFAULT_MODEL`
- `AI_PROVIDER_ALLOWLIST`
- `AI_PROVIDER_<NAME>_API_KEY`
- `AI_MAX_INPUT_TOKENS`
- `AI_MAX_OUTPUT_TOKENS`
- `AI_MONTHLY_PLATFORM_BUDGET`
- `AI_PROVIDER_TIMEOUT_MS`

Secrets must be stored in the hosting secret manager/environment and never committed to Git. Per-school routing should be server-controlled and auditable.

## 8. Stage boundary

This provider strategy belongs to Stage 2 governance and architecture. It does not implement provider adapters, change the active provider, alter secrets, or send data to another vendor. Stage 3 history persistence remains separate.

Before Stage 2 can close, the owner must choose the provider strategy and the exact provider/model must pass the due-diligence checklist. Legal/privacy and school approvals, approved retention, acceptance flow implementation, and synthetic-data staging remain release gates.

## 9. Official reference material reviewed

- OpenAI API data controls: https://developers.openai.com/api/docs/guides/your-data
- Anthropic API data retention: https://platform.claude.com/docs/en/build-with-claude/api-and-data-retention
- Anthropic commercial data use: https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training
- OpenRouter privacy policy: https://openrouter.ai/privacy

These references can change. Re-check the live contract and provider terms at procurement/activation time.
