-- Supabase exposes the public schema through its Data API to anyone holding
-- the project's public (anon) key. The app reaches the database only through
-- Prisma as the owner role, which bypasses RLS, so enabling RLS with no
-- policies closes the Data API without affecting the app. Idempotent; runs on
-- every deploy so new tables are covered too.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
