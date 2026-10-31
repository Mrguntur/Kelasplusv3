ALTER TABLE "users"
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMPTZ(6);

-- Permit looking up a session only when the caller supplies the hash of the
-- opaque session token they already possess. Mutations still require user context.
CREATE POLICY "sessions_token_lookup" ON "sessions"
  FOR SELECT
  USING (
    "token_hash" = NULLIF(current_setting('app.current_session_token_hash', true), '')
  );
