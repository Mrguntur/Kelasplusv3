-- Permit the public acceptance service to resolve exactly one invitation by
-- the digest of the presented high-entropy token. The application sets this
-- transaction-local context only after hashing the submitted token.
CREATE POLICY "school_admin_invitation_token_lookup"
  ON "school_admin_invitations"
  FOR SELECT
  USING (
    "token_hash" = NULLIF(current_setting('app.invitation_token_hash', true), '')
    AND "accepted_at" IS NULL
    AND "revoked_at" IS NULL
    AND "expires_at" > now()
  );

CREATE POLICY "school_admin_invitation_token_claim"
  ON "school_admin_invitations"
  FOR UPDATE
  USING (
    "token_hash" = NULLIF(current_setting('app.invitation_token_hash', true), '')
    AND "accepted_at" IS NULL
    AND "revoked_at" IS NULL
    AND "expires_at" > now()
  )
  WITH CHECK (
    "token_hash" = NULLIF(current_setting('app.invitation_token_hash', true), '')
    AND "accepted_at" IS NOT NULL
  );
