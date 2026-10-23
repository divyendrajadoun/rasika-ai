-- The browser never touches tables (every read and write goes through the server's own connection),
-- so the public Supabase roles get no write access. Without this, a signed-in user holding the
-- public anon key could PATCH their own profiles row (credits, plan) or mark a payment paid.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE NOTICE 'no Supabase roles: nothing to revoke';
    RETURN;
  END IF;
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
  REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
END $$;
