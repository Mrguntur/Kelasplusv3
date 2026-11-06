-- Track whether an AI request consumed included plan quota or paid add-on units.
-- Existing events remain PLAN so historical monthly usage is preserved.
ALTER TABLE "ai_usage_events"
  ADD COLUMN "quota_source" VARCHAR(20) NOT NULL DEFAULT 'PLAN';

ALTER TABLE "ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_quota_source_check"
  CHECK ("quota_source" IN ('PLAN', 'ADDON'));

CREATE INDEX "ai_usage_events_school_capability_source_created_idx"
  ON "ai_usage_events"("school_id", "capability", "quota_source", "created_at");

-- Dedicated transaction-local capability for trusted quota-ledger writes.
-- This is intentionally separate from the platform-admin authorization flag.
DROP POLICY IF EXISTS "ai_quota_ledger_trusted_insert" ON "ai_quota_ledger_entries";
CREATE POLICY "ai_quota_ledger_trusted_insert"
  ON "ai_quota_ledger_entries"
  FOR INSERT
  WITH CHECK (
    NULLIF(current_setting('app.is_trusted_ai_quota_writer', true), '') = 'true'
  );
