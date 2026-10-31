-- School administrator invitations store only a SHA-256 token digest.
-- The raw secret must be delivered out-of-band and must never be persisted or logged.
CREATE TABLE "school_admin_invitations" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "accepted_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_admin_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "school_admin_invitations_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "school_admin_invitations_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "school_admin_invitations_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "school_admin_invitations_school_id_email_created_at_idx"
  ON "school_admin_invitations"("school_id", "email", "created_at");
CREATE INDEX "school_admin_invitations_expires_at_idx"
  ON "school_admin_invitations"("expires_at");

ALTER TABLE "school_admin_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "school_admin_invitations" FORCE ROW LEVEL SECURITY;

-- Until a dedicated token-acceptance transaction/function is implemented and tested,
-- only the explicitly authorized platform-admin service may access invitation rows.
CREATE POLICY "school_admin_invitations_platform_admin"
  ON "school_admin_invitations"
  FOR ALL
  USING (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true')
  WITH CHECK (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true');
