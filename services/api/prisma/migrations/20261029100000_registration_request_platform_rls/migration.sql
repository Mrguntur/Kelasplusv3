-- Registration intake is public, but reviewing requests is platform-admin-only.
ALTER TABLE "school_registration_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "school_registration_requests" FORCE ROW LEVEL SECURITY;

CREATE POLICY "registration_requests_public_pending_intake"
  ON "school_registration_requests"
  FOR INSERT
  WITH CHECK (
    "status" = 'PENDING'::"RegistrationStatus"
    AND "reviewed_at" IS NULL
    AND "reviewed_by" IS NULL
    AND "rejection_reason" IS NULL
  );

CREATE POLICY "registration_requests_platform_admin_read"
  ON "school_registration_requests"
  FOR SELECT
  USING (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true');

CREATE POLICY "registration_requests_platform_admin_update"
  ON "school_registration_requests"
  FOR UPDATE
  USING (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true')
  WITH CHECK (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true');
