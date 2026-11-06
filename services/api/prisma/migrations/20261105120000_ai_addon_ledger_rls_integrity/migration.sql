-- Tighten AI add-on quota ledger writes to trusted backend transactions.
-- Also enforce that a ledger row cannot point at a purchase from another school.

DROP POLICY IF EXISTS "ai_addon_purchases_school_admin_insert" ON "ai_addon_purchases";
CREATE POLICY "ai_addon_purchases_school_admin_insert"
  ON "ai_addon_purchases"
  FOR INSERT
  WITH CHECK (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1
      FROM "school_memberships" m
      WHERE m."school_id" = "ai_addon_purchases"."school_id"
        AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND m."role" = 'SCHOOL_ADMIN'::"SchoolRole"
    )
    AND EXISTS (
      SELECT 1
      FROM "ai_addon_packs" p
      WHERE p."id" = "ai_addon_purchases"."pack_id"
        AND p."is_published" = true
    )
  );

-- No school member, including a school admin, may mint or alter quota by
-- inserting ledger rows directly. Trusted server-side payment/quota
-- transactions set this transaction-local flag after authorization.
DROP POLICY IF EXISTS "ai_quota_ledger_tenant_insert" ON "ai_quota_ledger_entries";
CREATE POLICY "ai_quota_ledger_trusted_insert"
  ON "ai_quota_ledger_entries"
  FOR INSERT
  WITH CHECK (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
  );

-- A composite key prevents a ledger row for School A from referencing a
-- purchase belonging to School B, even if application code has a bug.
CREATE UNIQUE INDEX IF NOT EXISTS "ai_addon_purchases_school_id_id_key"
  ON "ai_addon_purchases"("school_id", "id");

ALTER TABLE "ai_quota_ledger_entries"
  DROP CONSTRAINT IF EXISTS "ai_quota_ledger_entries_purchase_id_fkey";

ALTER TABLE "ai_quota_ledger_entries"
  ADD CONSTRAINT "ai_quota_ledger_entries_school_purchase_fkey"
  FOREIGN KEY ("school_id", "purchase_id")
  REFERENCES "ai_addon_purchases"("school_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
