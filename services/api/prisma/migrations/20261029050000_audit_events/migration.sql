CREATE TABLE "audit_events" (
  "id" UUID NOT NULL,
  "actor_user_id" UUID,
  "school_id" UUID,
  "event_type" VARCHAR(100) NOT NULL,
  "outcome" VARCHAR(20) NOT NULL,
  "request_id" VARCHAR(100),
  "ip_address" VARCHAR(64),
  "user_agent" VARCHAR(200),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "audit_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");
CREATE INDEX "audit_events_school_id_created_at_idx" ON "audit_events"("school_id", "created_at");
CREATE INDEX "audit_events_event_type_created_at_idx" ON "audit_events"("event_type", "created_at");

-- Audit records are append-only for the application runtime.
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_events_insert_authenticated_actor" ON "audit_events"
  FOR INSERT WITH CHECK (
    "actor_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR ("actor_user_id" IS NULL AND current_setting('app.current_user_id', true) IS NULL)
  );
CREATE POLICY "audit_events_deny_read" ON "audit_events"
  FOR SELECT USING (false);
CREATE POLICY "audit_events_deny_update" ON "audit_events"
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "audit_events_deny_delete" ON "audit_events"
  FOR DELETE USING (false);
