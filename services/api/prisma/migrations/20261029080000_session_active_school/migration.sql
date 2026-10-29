ALTER TABLE "sessions"
  ADD COLUMN "active_school_id" UUID;

CREATE INDEX "sessions_active_school_id_idx" ON "sessions"("active_school_id");
