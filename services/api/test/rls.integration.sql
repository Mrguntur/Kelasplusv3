\set ON_ERROR_STOP on
-- Runs only against disposable CI PostgreSQL after Prisma migrations.
CREATE ROLE kelasplus_runtime LOGIN PASSWORD 'runtime_ci_only' NOSUPERUSER NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO kelasplus_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "schools", "school_memberships", "sessions", "users" TO kelasplus_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "audit_events" TO kelasplus_runtime;

-- Seed fixtures as the migration/database owner, never as the runtime role.
INSERT INTO "schools" ("id","slug","name","status","timezone","locale","created_at","updated_at")
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','rls-school-a','RLS Test School A','ACTIVE','Asia/Makassar','id-ID',now(),now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','rls-school-b','RLS Test School B','ACTIVE','Asia/Makassar','id-ID',now(),now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "users" ("id","email","display_name","status","created_at","updated_at")
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01','rls-a@example.test','RLS User A','ACTIVE',now(),now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02','rls-b@example.test','RLS User B','ACTIVE',now(),now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "school_memberships" ("id","school_id","user_id","role","created_at")
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01','SCHOOL_ADMIN',now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb22','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02','SCHOOL_ADMIN',now())
ON CONFLICT ("school_id","user_id") DO NOTHING;

SET ROLE kelasplus_runtime;
BEGIN;
SELECT set_config('app.current_user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',true);
SELECT set_config('app.current_school_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

DO $$
DECLARE visible_schools integer;
BEGIN
  SELECT count(*) INTO visible_schools FROM "schools";
  IF visible_schools <> 1 THEN
    RAISE EXCEPTION 'RLS failure: School A expected 1 visible school, got %', visible_schools;
  END IF;

  IF EXISTS (SELECT 1 FROM "schools" WHERE "id" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') THEN
    RAISE EXCEPTION 'RLS failure: School A can see School B';
  END IF;

  IF EXISTS (SELECT 1 FROM "school_memberships" WHERE "school_id" = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') THEN
    RAISE EXCEPTION 'RLS failure: School A can see School B memberships';
  END IF;

  BEGIN
    INSERT INTO "school_memberships" ("id","school_id","user_id","role","created_at")
    VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccc33','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01','TEACHER',now());
    RAISE EXCEPTION 'RLS failure: cross-school membership write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected row-level security denial
  END;
END $$;
ROLLBACK;
RESET ROLE;

-- Audit events are append-only and actor-scoped under the runtime role.
SET ROLE kelasplus_runtime;
BEGIN;
INSERT INTO "audit_events" ("id", "actor_user_id", "event_type", "outcome", "metadata", "created_at")
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccc44', NULL, 'registration.test', 'SUCCESS', '{}'::jsonb, now());

SELECT set_config('app.current_user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',true);
INSERT INTO "audit_events" ("id", "actor_user_id", "event_type", "outcome", "metadata", "created_at")
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccc45', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'auth.test', 'SUCCESS', '{}'::jsonb, now());

DO $
BEGIN
  BEGIN
    INSERT INTO "audit_events" ("id", "actor_user_id", "event_type", "outcome", "metadata", "created_at")
    VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccc46', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02', 'auth.test', 'SUCCESS', '{}'::jsonb, now());
    RAISE EXCEPTION 'RLS failure: actor A inserted an audit event for actor B';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected row-level security denial
  END;

  IF EXISTS (SELECT 1 FROM "audit_events") THEN
    RAISE EXCEPTION 'RLS failure: runtime role can read audit events';
  END IF;
END $;
ROLLBACK;
RESET ROLE;

-- Missing tenant context must fail closed.
SET ROLE kelasplus_runtime;
BEGIN;
DO $$
DECLARE visible_schools integer;
BEGIN
  SELECT count(*) INTO visible_schools FROM "schools";
  IF visible_schools <> 0 THEN
    RAISE EXCEPTION 'RLS failure: no context should see 0 schools, got %', visible_schools;
  END IF;
END $$;
ROLLBACK;
RESET ROLE;

REVOKE ALL ON "schools", "school_memberships", "sessions", "users", "audit_events" FROM kelasplus_runtime;
