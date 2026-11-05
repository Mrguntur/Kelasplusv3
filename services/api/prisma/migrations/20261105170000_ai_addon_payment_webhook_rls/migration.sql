-- Allow trusted payment webhook transactions to read purchase and ledger rows
-- without impersonating a school member. Tenant reads remain membership-scoped.
DROP POLICY IF EXISTS "ai_addon_purchases_tenant_read" ON "ai_addon_purchases";
CREATE POLICY "ai_addon_purchases_tenant_read"
  ON "ai_addon_purchases"
  FOR SELECT
  USING (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    OR (
      "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
      AND EXISTS (
        SELECT 1 FROM "school_memberships" m
        WHERE m."school_id" = "ai_addon_purchases"."school_id"
          AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "ai_quota_ledger_tenant_read" ON "ai_quota_ledger_entries";
CREATE POLICY "ai_quota_ledger_tenant_read"
  ON "ai_quota_ledger_entries"
  FOR SELECT
  USING (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    OR (
      "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
      AND EXISTS (
        SELECT 1 FROM "school_memberships" m
        WHERE m."school_id" = "ai_quota_ledger_entries"."school_id"
          AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );
