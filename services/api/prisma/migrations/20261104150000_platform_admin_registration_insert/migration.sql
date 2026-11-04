-- Allow authenticated platform admins to create manually approved
-- school registration requests. Public intake remains PENDING-only.

CREATE POLICY "registration_requests_platform_admin_insert"
  ON "school_registration_requests"
  FOR INSERT
  WITH CHECK (
    NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
    AND "status" = 'APPROVED'::"RegistrationStatus"
    AND "reviewed_at" IS NOT NULL
    AND "reviewed_by" =
      NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND "rejection_reason" IS NULL
  );
