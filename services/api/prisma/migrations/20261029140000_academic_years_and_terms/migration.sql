-- Academic year and term tables for the first academic slice.
-- Tenant rows fail closed unless the API sets app.current_school_id after
-- session and membership validation. Composite FK prevents cross-school terms.
CREATE TYPE "AcademicYearStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

CREATE TABLE "academic_years" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "name" VARCHAR(40) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" "AcademicYearStatus" NOT NULL DEFAULT 'PLANNED',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "academic_years_date_order_check" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "academic_years_school_id_id_key" UNIQUE ("school_id", "id"),
  CONSTRAINT "academic_years_school_id_name_key" UNIQUE ("school_id", "name"),
  CONSTRAINT "academic_years_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "academic_years_school_id_status_start_date_idx"
  ON "academic_years"("school_id", "status", "start_date");

CREATE TABLE "terms" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "sequence" INTEGER NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "terms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "terms_date_order_check" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "terms_sequence_positive_check" CHECK ("sequence" > 0),
  CONSTRAINT "terms_school_id_academic_year_id_sequence_key"
    UNIQUE ("school_id", "academic_year_id", "sequence"),
  CONSTRAINT "terms_school_id_academic_year_id_fkey"
    FOREIGN KEY ("school_id", "academic_year_id")
    REFERENCES "academic_years"("school_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "terms_school_id_academic_year_id_idx"
  ON "terms"("school_id", "academic_year_id");

ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_years" FORCE ROW LEVEL SECURITY;
CREATE POLICY "academic_years_tenant_scope"
  ON "academic_years"
  USING (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" m
      WHERE m."school_id" = "academic_years"."school_id"
        AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" m
      WHERE m."school_id" = "academic_years"."school_id"
        AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

ALTER TABLE "terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "terms" FORCE ROW LEVEL SECURITY;
CREATE POLICY "terms_tenant_scope"
  ON "terms"
  USING (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" m
      WHERE m."school_id" = "terms"."school_id"
        AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" m
      WHERE m."school_id" = "terms"."school_id"
        AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
