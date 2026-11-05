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


## 10. Owner-selected strategy — aggregator, balanced budget

The product owner selected an **aggregator strategy** with a **balanced** cost/quality priority. This is the chosen architecture direction. OpenRouter is the first aggregator candidate to evaluate, not yet an approved production subprocessor or final provider.

### Official OpenRouter findings reviewed 5 Nov 2026

- OpenRouter's Privacy Policy says it does not use Inputs or Outputs for its own model training, but sends Inputs to the selected or automatically routed Model Provider. The underlying provider may retain or use Inputs/Outputs for training or improvement depending on that provider's terms.
- OpenRouter's provider-logging documentation describes provider-level data policy tiers (including Zero Retention and Safety Retention) and account/request-level filters to restrict routing by data policy. These controls must be explicitly configured and verified; a general “paid” route does not itself establish an acceptable retention policy.
- OpenRouter states Business/Enterprise plans support EU and US in-region routing. This does not establish Indonesian data residency; the actual route and transfer implications must be reviewed.
- OpenRouter's privacy policy says a Data Processing Agreement and separate agreements with model providers govern API/Enterprise handling where applicable. Obtain and review the actual executed DPA and provider chain before production.

Official references:
- https://openrouter.ai/privacy
- https://openrouter.ai/docs/guides/privacy/provider-logging
- https://openrouter.ai/enterprise/form

### Provisional KELAS+ aggregator policy

1. Evaluate OpenRouter Business/Enterprise or an equivalent contract-capable aggregator; compare total cost, not just token price.
2. Disable free-model routing for all school data.
3. Require provider-level no-training commitment and an approved retention tier for every route. Prefer ZDR; Safety Retention is a separate, explicit approval decision and is not equivalent to ZDR.
4. Use a static allowlist of exact provider/model/endpoint combinations. Do not use automatic routing across unknown providers for student-case requests.
5. Review the underlying model provider's DPA, retention, processing location, subprocessors, deletion, and age/education restrictions independently.
6. If the route cannot prove its approved policy, block the request. Never silently fall back to a different model/provider.
7. Start with synthetic data and a cost/quality benchmark. No real student data until written provider, legal/privacy, and school approvals are recorded.

### Balanced budget policy proposal

- Route routine drafting/formatting to an approved lower-cost model.
- Route complex pedagogical reasoning to an approved stronger model only when needed.
- Apply per-school monthly spend caps and capability quotas, plus platform-wide hard stop.
- Enforce maximum input/output tokens, request rate, timeout, and concurrency.
- Track cost and usage by school/capability/provider/model without storing prompts or student identity.
- No automatic paid overage unless explicitly included in the school's subscription terms.

The aggregator selection is an architectural decision. OpenRouter's actual contract, specific model routes, pricing, account tier, regional processing, and KELAS+ education/minor-access suitability remain unverified. This section is not approval to send personal/student data.


## 11. Owner decision — school-level cost control and approved-only fallback

Confirmed by product owner:
- Cost ownership and hard-stop accounting are **per school**. Each school must have an independent monthly monetary ceiling; one school's usage must never consume another school's budget.
- Fallback is **approved-only**. A retry/fallback may use only an explicitly approved provider + exact model/endpoint route with equal or stricter data controls. No generic cheapest-model fallback and no free-model routing for school data.
- If the school's budget is exhausted, the route is unapproved, or all approved routes are unavailable, stop and return a safe unavailable response. No paid overage unless the school's subscription terms expressly authorize it.

The owner has not yet specified the monetary ceiling or currency. Therefore no numeric cap is invented. Until a per-school cap and route pricing are configured, outbound provider traffic must remain disabled.

## 12. Stage 2 gateway implementation boundary

A server-side `AiGatewayService` has been added as the mandatory fail-closed boundary. Both teacher/leadership generation and individual student-case analysis call the guard before context construction, usage reservation, or provider network access. The current approval registry is intentionally empty, so requests return HTTP 503 and no model provider receives data. Existing Gemini direct-call code remains unreachable behind this guard and must be replaced by a gateway adapter before any route can be enabled.

This is a safety boundary, not an active provider integration. No OpenRouter key, provider adapter, external request, or real student-data transfer has been enabled.

### Required gateway contract before activation

1. **Tenant budget:** store one budget policy per school and billing period; reserve estimated cost atomically before sending; settle actual cost from provider usage/pricing after response; release or reconcile reservations on failure. Never use a platform-wide shared pool as a substitute for the school's cap.
2. **No overspend under concurrency:** lock the school's budget row (or use an atomic conditional update) in the same transaction as reservation. Reject if reserved + settled + estimated request cost exceeds the school ceiling.
3. **Approved route registry:** exact provider, model, endpoint, capability/data categories, retention tier, training policy, region, effective dates, reviewer and evidence. Unknown or expired routes are denied.
4. **Approved-only fallback:** iterate only the ordered approved route list; each route must meet the request's data classification. Disable provider-side arbitrary fallback and free-model routes.
5. **Usage accounting:** record school, capability, provider, model, input/output tokens, estimated/actual cost, currency, latency and status. Never store prompts, student names, student IDs, or provider payloads in usage records.
6. **Limits:** enforce input/output token ceilings, request timeout, per-school concurrency/rate limits, monthly monetary cap, and capability quota.
7. **Kill switch:** platform-wide emergency disable plus per-school disable; both fail closed.
8. **Student-case restriction:** keep individual student-case routing disabled until the specific route and student-data category receive separate written approval. Synthetic tests only before that gate.
9. **Operational evidence:** test route denial, no-provider/no-network behavior, budget concurrency, exhausted budget, route fallback allowlist, provider failure, timeout, and absence of prompt/identity logging.

### Implementation status (5 Nov 2026)

- [x] Add server-side gateway boundary.
- [x] Register gateway in the AI module.
- [x] Guard teacher/leadership and student-case entry points before context reads, quota reservation, and network calls.
- [x] Add a unit test asserting unapproved routes fail closed.
- [ ] Replace legacy direct Gemini calls with provider adapters behind the gateway.
- [ ] Add per-school monetary budget policy and atomic spend reservations.
- [ ] Add provider/model approval registry and approved-only fallback.
- [ ] Add synthetic-data integration tests and cost-accounting tests.
- [ ] Complete legal, provider, school and child-data approvals.

The monetary ceiling, currency, and period configuration remain a product/finance input. Until supplied and implemented, the current monthly request-count quota is not represented as a monetary spend cap.


## 13. Owner-selected Indonesian aggregator candidate — MindRouter

The owner selected MindRouter as the first candidate for a controlled integration and synthetic-data evaluation. This is a candidate selection for engineering work, not approval to process school/student personal data and not evidence that its upstream routes satisfy KELAS+ requirements.

### Observed price snapshot supplied by the owner (5 Nov 2026)

The supplied MindRouter model table shows the following route and displayed prices:

| Display name | Model identifier | Input / 1M tokens | Output / 1M tokens |
|---|---|---:|---:|
| DeepSeek v4.1 Flash 1017 [ID] | `mindrouter/deepseek-v4.1-flash` | USD 0.22 (approx. Rp4,029) | USD 0.90 (approx. Rp16,484) |
| DeepSeek v4.1 Flash 1017 [Research] [ID] | `mindrouter/deepseek-v4.1-flash-research` | USD 0.25 (approx. Rp4,579) | USD 0.80 (approx. Rp14,653) |

These values are a dated screenshot snapshot, not a live price feed or a contractual quote. Confirm current prices, billing currency, FX conversion, markup, taxes, minimum top-up, and any provider-side fees before setting budgets.

Illustrative request estimate for the first route:
- 2,000 input tokens: about Rp8.06.
- 1,000 output tokens: about Rp16.48.
- Total: about Rp24.54 per request, before FX/rounding, fees, taxes, and any hidden upstream pricing adjustments.

Actual usage must use the provider's returned token counts and the exact approved route's effective price. Do not estimate production spend from request count alone.

### Candidate due-diligence gate

Before any MindRouter request may contain school or student data, obtain written evidence for:
- MindRouter's legal contracting entity, registration, invoice/tax details, and support contact.
- Executed DPA/processor terms and the complete upstream model-provider/subprocessor chain for the exact model ID.
- Prompt/response retention at MindRouter and each upstream provider, including abuse/security logging and deletion windows.
- No-training/no-improvement commitments and any human review exceptions.
- Processing locations, international transfers, support access, and deletion/incident-notification commitments.
- Education/minor-access suitability and contractual permission for a multi-tenant school SaaS.
- Exact endpoint, API compatibility, route stability, rate limits, token accounting, price schedule, and billing controls.

Public website statements and a local-currency payment method are not substitutes for this evidence. Until reviewed and approved, MindRouter is not an approved production subprocessor.

### Engineering rollout

1. Implement the provider-neutral gateway and an OpenAI-compatible MindRouter adapter behind a disabled-by-default route switch.
2. Keep the approved-route registry empty until evidence and owner approval are recorded.
3. Run integration tests only with synthetic fixtures and a separately authorized test key/account; do not put keys in Git.
4. Validate response parsing, provider-reported token usage, timeout/error handling, per-school attribution, and no prompt/identity logging.
5. Implement per-school monetary budget reservation/settlement before any production route can be enabled.
6. Keep individual student-case analysis blocked until it has a separate data-category approval.

The current runtime remains fail-closed. Selecting MindRouter as the first integration candidate does not automatically enable outbound traffic.


## 14. Superseding owner decision — MindRouter candidate (5 Nov 2026)

**This section supersedes the earlier OpenRouter-first-candidate wording in Section 10 and any earlier governance note naming OpenRouter as the current candidate.** The owner has since selected MindRouter as the first aggregator candidate to evaluate. OpenRouter remains only a historical alternative considered; it is not the active candidate in the current plan.

MindRouter is a candidate for a controlled engineering integration and synthetic-data evaluation only. It is **not** an approved production provider/subprocessor, and this selection does not authorize sending school or student personal data.

Required gates remain:
- Verify the legal contracting entity, executed DPA/processor terms, upstream provider/subprocessor chain for each exact model route, retention and abuse/security logging, no-training terms, deletion, processing region and international transfers, incident notification, and education/minor-access suitability.
- Verify exact API endpoint/compatibility, model identifiers, route stability, provider-reported token accounting, current pricing, billing currency, rate limits, and account controls.
- Keep the approved-route registry empty until written evidence is reviewed and approval is recorded.
- Use only synthetic fixtures and a separately authorized test account/key for integration tests. Store secrets only in backend secret configuration; never commit or expose them to browser/mobile clients.
- Implement per-school monetary caps and atomic budget reservation/settlement before any route can be activated. No numeric cap is approved yet.
- Keep student-case analysis blocked from external providers until it receives separate data-category, legal/privacy, provider, and school approval.

The model-price snapshot supplied by the owner is informational and must be rechecked against current contractual pricing before budgeting. Do not treat the snapshot as a quote or guarantee.

Current runtime boundary is unchanged: AiGatewayService fails closed, the route registry is empty, and no provider traffic is authorized. MindRouter adapter work, if started, must remain disabled by default and synthetic-data-only.


## 15. MindRouter synthetic adapter implementation status

A provider-neutral request/result contract and `MindRouterSyntheticAdapter` have been added for controlled integration testing. The adapter uses the OpenAI-compatible Chat Completions endpoint and normalizes answer/model/token usage. It is registered in the AI module but is **not injected into `AiService` and is not called by any user-facing endpoint**.

Safety controls:
- The adapter method is explicitly named `generateSyntheticTest`.
- It refuses execution in `NODE_ENV=production`.
- It requires `AI_MINDROUTER_SYNTHETIC_TESTS_ENABLED=true` and backend-only `MINDROUTER_API_KEY` / `MINDROUTER_MODEL` configuration.
- It uses a fixed HTTPS endpoint, a 20-second timeout, and generic errors that do not expose provider response details.
- Automated tests cover production blocking, missing opt-in, request format, normalized token usage, HTTP failure, and empty fixtures.

The explicit flag is a development/test harness, not a legal or provider approval. Do not enable it against real school data. No API key is committed. The main `AiGatewayService` remains fail-closed, and existing Gemini code remains unreachable. No real provider traffic, production activation, schema change, merge, or deployment is authorized by this implementation.

## AI quota add-ons and school cost protection

The product and engineering baseline for school-purchased AI quota add-ons is documented in [AI-QUOTA-ADDON-BUSINESS-RULES.md](./AI-QUOTA-ADDON-BUSINESS-RULES.md). Included plan quota and purchased add-on units are tracked separately; actual provider cost is controlled by an independent per-school monetary ceiling. Add-ons are granted only after verified payment confirmation. Missing cost ceilings or model rate cards keep provider traffic blocked. This specification does not approve a provider route or enable production traffic.
