\set ON_ERROR_STOP on
-- Validate billing tables cannot silently ship without forced row-level security.
DO $$
DECLARE
  table_name TEXT;
  rls_enabled BOOLEAN;
  rls_forced BOOLEAN;
  admin_policy_count INTEGER;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['plans', 'subscriptions', 'invoices', 'payments'] LOOP
    SELECT c.relrowsecurity, c.relforcerowsecurity
      INTO rls_enabled, rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = table_name;

    IF COALESCE(rls_enabled, false) IS NOT TRUE OR COALESCE(rls_forced, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Billing RLS failure: %.relrowsecurity and FORCE RLS must both be enabled', table_name;
    END IF;

    SELECT count(*) INTO admin_policy_count
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = table_name
       AND policyname = CASE
         WHEN table_name = 'plans' THEN 'plans_platform_admin_all'
         ELSE table_name || '_platform_admin_all'
       END
       AND cmd = 'ALL';

    IF admin_policy_count <> 1 THEN
      RAISE EXCEPTION 'Billing RLS failure: expected exactly one platform-admin policy on %', table_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'plans'
       AND policyname = 'plans_public_published_read'
       AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Billing RLS failure: published-plan public read policy is missing';
  END IF;
END $$;
