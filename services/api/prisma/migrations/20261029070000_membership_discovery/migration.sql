-- Allow an authenticated user to discover only their own school memberships
-- before selecting an active school. Existing ALL policy still requires an explicit
-- school context for membership writes, so this does not widen write permissions.
CREATE POLICY "memberships_list_own_schools" ON "school_memberships"
  FOR SELECT USING (
    "user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.current_school_id', true), '') IS NULL
      OR "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    )
  );
