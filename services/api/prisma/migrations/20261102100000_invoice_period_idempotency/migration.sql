-- KELAS+ Platform V2: invoice period idempotency
ALTER TABLE "invoices"
  ADD COLUMN "period_start" TIMESTAMPTZ(6),
  ADD COLUMN "period_end" TIMESTAMPTZ(6);

-- Existing invoice rows (if any) are backfilled from their subscription period.
UPDATE "invoices" AS i
SET "period_start" = s."current_period_start",
    "period_end" = s."current_period_end"
FROM "subscriptions" AS s
WHERE i."subscription_id" = s."id";

ALTER TABLE "invoices"
  ALTER COLUMN "period_start" SET NOT NULL,
  ALTER COLUMN "period_end" SET NOT NULL,
  ADD CONSTRAINT "invoices_period_check" CHECK ("period_end" > "period_start");

CREATE UNIQUE INDEX "invoices_subscription_period_key"
  ON "invoices"("subscription_id", "period_start", "period_end");
