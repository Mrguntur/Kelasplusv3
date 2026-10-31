-- Fail-closed baseline policies. API endpoints are not implemented yet.
-- Runtime must set these settings transaction-locally only after authentication
-- and server-side membership validation. A missing setting denies tenant rows.
-- Production role grants and onboarding workflow require separate review.

ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schools" FORCE ROW LEVEL SECURITY;
CREATE POLICY "schools_tenant_scope" ON "schools"
  USING (
    "id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" m
      WHERE m."school_id" = "schools"."id"
        AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (false); -- school creation/onboarding uses a separately reviewed path

ALTER TABLE "school_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "school_memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "memberships_self_scope" ON "school_memberships"
  USING (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND "user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  )
  WITH CHECK (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND "user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sessions_user_scope" ON "sessions"
  USING ("user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK ("user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- users are global identities and deliberately not school-scoped here.
-- They still require narrowly scoped API access and must never be exposed
-- through generic list/read endpoints.
