-- Tenant-scoped audit and monthly quota accounting for AI requests.
CREATE TABLE "ai_usage_events" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "capability" VARCHAR(40) NOT NULL,
  "model" VARCHAR(80) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_usage_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_usage_events_tokens_nonnegative_check" CHECK ("prompt_tokens" >= 0 AND "completion_tokens" >= 0)
);

CREATE INDEX "ai_usage_events_school_capability_created_idx"
  ON "ai_usage_events"("school_id", "capability", "created_at");
CREATE INDEX "ai_usage_events_user_created_idx"
  ON "ai_usage_events"("user_id", "created_at");

ALTER TABLE "ai_usage_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_usage_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_events_tenant_select" ON "ai_usage_events"
  FOR SELECT USING (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" m
      WHERE m."school_id" = "ai_usage_events"."school_id"
        AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

CREATE POLICY "ai_usage_events_tenant_insert" ON "ai_usage_events"
  FOR INSERT WITH CHECK (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND "user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

CREATE POLICY "ai_usage_events_tenant_update" ON "ai_usage_events"
  FOR UPDATE
  USING (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND "user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  )
  WITH CHECK (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND "user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
