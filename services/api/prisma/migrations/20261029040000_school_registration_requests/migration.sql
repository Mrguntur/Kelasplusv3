CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "school_registration_requests" (
  "id" UUID NOT NULL,
  "school_name" VARCHAR(200) NOT NULL,
  "requested_slug" VARCHAR(80) NOT NULL,
  "contact_name" VARCHAR(200) NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "phone" VARCHAR(40),
  "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_at" TIMESTAMPTZ(6),
  "reviewed_by" UUID,
  "rejection_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_registration_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_registration_requests_status_created_at_idx"
  ON "school_registration_requests"("status", "created_at");
CREATE INDEX "school_registration_requests_email_created_at_idx"
  ON "school_registration_requests"("email", "created_at");

-- Public intake is not tenant data. School activation and account creation are
-- deliberately separate, privileged workflows requiring review.
