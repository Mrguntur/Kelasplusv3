# KELAS+ AI Quota Add-ons — Product and Engineering Rules

Status: Proposed implementation baseline
Branch: `feat/ai-privacy-audit-stage-2`
Scope: AI request entitlements, paid add-ons, billing integration, and provider cost protection.

## Product decision

KELAS+ will support paid AI quota top-ups (add-ons). A school does not need to upgrade its subscription solely because its included AI request allowance has been exhausted. A school administrator can purchase an add-on while keeping the current subscription.

The purchase experience should be self-service, transparent, and activated automatically only after the payment provider confirms successful payment.

## User experience

1. Show included monthly AI quota, consumed quota, remaining quota, and separately purchased add-on balance.
2. Warn school administrators before exhaustion (recommended thresholds: 20% and 10% remaining).
3. When quota is exhausted, explain the reason and offer two clear actions: buy an add-on or compare subscription plans.
4. Show add-on pack size, price, expiry, payment status, and remaining balance before checkout.
5. Activate purchased quota only after a verified, idempotent payment-success event. A pending/failed/expired payment never grants quota.
6. Teachers see a clear unavailable/quota-exhausted message and may ask their school administrator; only authorized school billing roles can purchase.

## Consumption rules

- Keep plan-included allowance and purchased allowance separately identifiable in the ledger.
- Plan allowance resets according to the subscription's actual billing period, not an assumed calendar month.
- Purchased allowance is consumed only after the included allowance for the current period is exhausted. This preserves the value of the subscription allowance and makes the balance understandable.
- Consume purchased units using earliest-expiry-first (FIFO by expiry, then purchase time).
- An add-on pack is school-scoped and can never be transferred to another school.
- The initial commercial default is expiry at the end of the current paid subscription period. The platform must show this clearly before purchase. If a school has no active paid period (for example, a trial), checkout must not offer a paid add-on until the policy is explicitly configured for that subscription state.
- No negative balances, no silent overage, and no cross-school/shared quota pools.
- Failed provider requests must release/restore the reserved request unit safely; ambiguous provider timeouts must be reconciled rather than blindly refunded or charged twice.
- Use database transactions and school-row locking for reservation/settlement so concurrent requests cannot overspend.

## Cost protection (separate from request quota)

Request quota is a product entitlement, not a guarantee of unlimited provider spend. Maintain a separate per-school monetary cost ledger in IDR (or a configured settlement currency) based on model and token usage.

- Reserve a conservative estimated provider cost before outbound model traffic.
- Settle the reservation using actual provider-reported token usage and the approved model rate card.
- Release unused reservation after settlement; record adjustments for late or missing provider usage.
- Enforce a platform-configured monthly school cost ceiling independently of request quota and add-on balance.
- If the cost ceiling is reached, fail closed even when the school still has request units.
- Do not invent model prices. Missing/stale rate-card entries, missing school cost ceiling, or unknown provider pricing must block outbound calls.
- No paid fallback provider, automatic overage, or cross-subsidy unless explicitly approved and contractually supported.

## Billing and payment integrity

- Add-on catalog entries are platform-admin managed and versioned. Each purchase snapshots pack size, price, currency, and expiry policy so later catalog edits do not alter an existing order.
- Reuse the existing invoice/payment foundation where possible, but do not attach add-ons to subscription invoices in a way that changes subscription lifecycle semantics.
- Payment webhooks must verify signatures, amount, currency, provider reference, and terminal payment status.
- Grant quota exactly once using provider event/idempotency keys and a unique grant reference.
- Refund/reversal must create a compensating ledger entry; never delete or rewrite historical grant/consumption records.
- Do not store sensitive payment credentials. Retain only required provider references and safe audit metadata.

## Authorization and tenant isolation

- Only SCHOOL_ADMIN and explicitly authorized billing operators may view school billing balances or initiate add-on purchases. Teachers and leaders may see availability appropriate to their role but cannot buy or change billing.
- Every read/write is scoped to the authenticated active school and verified membership.
- Platform administration of catalog, pricing, rate cards, and cost ceilings is restricted to platform admins.
- Apply tenant RLS and school-row locking to all balance mutations.
- Audit purchase creation, payment confirmation, grant, consumption, reservation, settlement, reversal, and admin configuration changes. Never place raw prompts, student identities, API keys, or payment secrets in audit metadata.

## Commercial configuration — intentionally not hard-coded

The following must be configurable by platform administrators and remain unpublished until approved:
- Pack sizes (request units).
- Pack prices and currency.
- Add-on expiry policy and eligible subscription states.
- Per-school monthly provider-cost ceiling.
- Provider/model rate cards and effective dates.
- Warning thresholds and any applicable tax treatment.

No example price or pack size in product discussions is a production price.

## Delivery sequence

1. Define immutable quota ledger and add-on order/grant schema; preserve existing AI usage history.
2. Implement atomic included-quota/add-on reservation and settlement, including failed and ambiguous request handling.
3. Add platform-admin catalog and cost/rate-card configuration with fail-closed defaults.
4. Integrate add-on checkout with existing payment infrastructure and idempotent webhook grant.
5. Add school billing dashboard, top-up purchase flow, and quota warning states.
6. Test concurrency, tenant RLS, duplicate webhooks, payment reversal, expiry, cost ceiling, and provider failure paths.
7. Keep provider routing disabled until legal/privacy/provider approval, rate cards, cost ceilings, and school approvals are complete.

## Acceptance criteria

- A school can exhaust included quota and continue only after a successfully paid add-on is granted.
- A pending, failed, expired, forged, or duplicate payment cannot increase balance.
- Two concurrent requests cannot consume the same unit.
- A school cannot read or spend another school's quota.
- Expired add-on units are unavailable and remain visible in historical ledger reporting.
- Provider cost ceiling blocks usage independently of request balance.
- Missing pricing/cost configuration blocks provider traffic.
- Usage and balance shown to school administrators reconcile to immutable ledger entries.
- No production activation or provider traffic is enabled by this specification alone.
