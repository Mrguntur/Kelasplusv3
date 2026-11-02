-- Teacher invitations are isolated from school-admin invitations and always create TEACHER membership.
CREATE TABLE "teacher_invitations" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "display_name" VARCHAR(200) NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "accepted_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teacher_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "teacher_invitations_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "teacher_invitations_token_hash_key" ON "teacher_invitations"("token_hash");
CREATE INDEX "teacher_invitations_school_id_email_created_at_idx"
  ON "teacher_invitations"("school_id", "email", "created_at");
CREATE INDEX "teacher_invitations_expires_at_idx" ON "teacher_invitations"("expires_at");

ALTER TABLE "teacher_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_invitations" FORCE ROW LEVEL SECURITY;

-- School administrators and leaders may manage invitations only inside their active tenant.
CREATE POLICY "teacher_invitations_tenant_manage"
ON "teacher_invitations"
FOR ALL
USING (
  current_setting('app.is_platform_admin', true) = 'true'
  OR (
    "school_id" = nullif(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" membership
      WHERE membership."school_id" = "teacher_invitations"."school_id"
        AND membership."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid
        AND membership."role" IN ('SCHOOL_ADMIN', 'SCHOOL_LEADER')
    )
  )
)
WITH CHECK (
  current_setting('app.is_platform_admin', true) = 'true'
  OR (
    "school_id" = nullif(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" membership
      WHERE membership."school_id" = "teacher_invitations"."school_id"
        AND membership."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid
        AND membership."role" IN ('SCHOOL_ADMIN', 'SCHOOL_LEADER')
    )
  )
);

-- A bearer token grants access only to its matching invitation row for preview/accept.
CREATE POLICY "teacher_invitations_token_select"
ON "teacher_invitations"
FOR SELECT
USING ("token_hash" = current_setting('app.invitation_token_hash', true));

CREATE POLICY "teacher_invitations_token_update"
ON "teacher_invitations"
FOR UPDATE
USING ("token_hash" = current_setting('app.invitation_token_hash', true))
WITH CHECK ("token_hash" = current_setting('app.invitation_token_hash', true));
