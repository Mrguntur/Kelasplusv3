-- Initial KELAS+ Platform V2 schema.
-- Apply only to disposable/local databases until reviewed and approved.
CREATE TYPE "SchoolStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');
CREATE TYPE "SchoolRole" AS ENUM ('SCHOOL_ADMIN', 'SCHOOL_LEADER', 'TEACHER', 'SCHOOL_OPERATOR');

CREATE TABLE "schools" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "status" "SchoolStatus" NOT NULL DEFAULT 'PENDING',
  "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Makassar',
  "locale" VARCHAR(20) NOT NULL DEFAULT 'id-ID',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "display_name" VARCHAR(200) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
  "password_hash" VARCHAR(255),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "school_memberships" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "SchoolRole" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "last_seen_at" TIMESTAMPTZ(6),
  "device_label" VARCHAR(200),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "schools_slug_key" ON "schools"("slug");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "school_memberships_school_id_user_id_key" ON "school_memberships"("school_id", "user_id");
CREATE INDEX "school_memberships_user_id_school_id_idx" ON "school_memberships"("user_id", "school_id");
CREATE INDEX "school_memberships_school_id_role_idx" ON "school_memberships"("school_id", "role");
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

ALTER TABLE "school_memberships"
  ADD CONSTRAINT "school_memberships_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_memberships"
  ADD CONSTRAINT "school_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
