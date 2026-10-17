-- Row-level security (SPEC §11). Applied only where Supabase's `auth` schema exists;
-- on plain Postgres (docker compose) this block is a no-op and ownership is enforced in code.
DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    RAISE NOTICE 'auth schema not present: skipping RLS policies';
    RETURN;
  END IF;

  -- tables that carry user_id directly
  FOREACH t IN ARRAY ARRAY['profiles','brand_kits','projects','assets','jobs','credit_ledger','payments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_owner', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      t || '_owner', t);
  END LOOP;

  -- project-scoped tables
  FOREACH t IN ARRAY ARRAY['transcripts','edit_plans'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_owner', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = %I.project_id AND p.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = %I.project_id AND p.user_id = auth.uid()))',
      t || '_owner', t, t, t);
  END LOOP;

  -- audit log: users may read their own rows; only the service role writes
  EXECUTE 'ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS audit_log_read ON audit_log';
  EXECUTE 'CREATE POLICY audit_log_read ON audit_log FOR SELECT TO authenticated USING (user_id = auth.uid())';
END $$;
