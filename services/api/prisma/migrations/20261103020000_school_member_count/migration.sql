-- Maintain a tenant-safe, transactionally updated membership count for user quotas.
ALTER TABLE "schools"
  ADD COLUMN "member_count" INTEGER NOT NULL DEFAULT 0;

UPDATE "schools" AS s
SET "member_count" = (
  SELECT COUNT(*)::INTEGER
  FROM "school_memberships" AS m
  WHERE m."school_id" = s."id"
);

ALTER TABLE "schools"
  ADD CONSTRAINT "schools_member_count_nonnegative_check"
  CHECK ("member_count" >= 0);
