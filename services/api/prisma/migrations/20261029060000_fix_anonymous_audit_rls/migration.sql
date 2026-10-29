-- PostgreSQL may expose a reset custom GUC as an empty string after a
-- transaction-local setting is rolled back. Normalize both absent and empty
-- values so anonymous audit inserts remain possible only without a user context.
DROP POLICY IF EXISTS "audit_events_insert_authenticated_actor" ON "audit_events";
CREATE POLICY "audit_events_insert_authenticated_actor" ON "audit_events"
  FOR INSERT WITH CHECK (
    "actor_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR (
      "actor_user_id" IS NULL
      AND NULLIF(current_setting('app.current_user_id', true), '') IS NULL
    )
  );
