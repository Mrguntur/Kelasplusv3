-- Local-only non-superuser runtime role so Docker API requests are subject to RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kelasplus_runtime') THEN
    CREATE ROLE kelasplus_runtime
      LOGIN PASSWORD 'local_runtime_password_only'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

ALTER ROLE kelasplus_runtime
  WITH PASSWORD 'local_runtime_password_only'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

GRANT CONNECT ON DATABASE kelasplus_dev TO kelasplus_runtime;
GRANT USAGE ON SCHEMA public TO kelasplus_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kelasplus_runtime;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO kelasplus_runtime;

ALTER DEFAULT PRIVILEGES FOR ROLE kelasplus_dev IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kelasplus_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE kelasplus_dev IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO kelasplus_runtime;
