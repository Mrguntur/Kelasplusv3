-- KELAS+ Platform V2: protect commercial catalog and billing records at the database boundary.
-- Public users may read published plans only. All mutations and private billing
-- records require a transaction-local platform-admin context set by guarded API code.
-- Midtrans notifications use the same restricted server-side context after signature verification.

ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_published_read"
  ON "plans"
  FOR SELECT
  USING ("is_published" = true);

CREATE POLICY "plans_platform_admin_all"
  ON "plans"
  FOR ALL
  USING (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true')
  WITH CHECK (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true');

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['subscriptions', 'invoices', 'payments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (NULLIF(current_setting(''app.is_platform_admin'', true), '''') = ''true'') WITH CHECK (NULLIF(current_setting(''app.is_platform_admin'', true), '''') = ''true'')',
      table_name || '_platform_admin_all',
      table_name
    );
  END LOOP;
END $$;
