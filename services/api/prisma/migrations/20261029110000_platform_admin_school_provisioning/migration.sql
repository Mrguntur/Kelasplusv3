-- Platform admins may create a PENDING school during reviewed onboarding.
-- They may not activate it or assign memberships through this policy alone.
CREATE POLICY "schools_platform_admin_review"
  ON "schools"
  FOR ALL
  USING (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true')
  WITH CHECK (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true');
