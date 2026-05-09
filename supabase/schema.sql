-- ============================================================================
-- dawushiye-dashboard · initial schema
-- ============================================================================
-- Paste this whole file into the Supabase SQL editor and click Run.
-- Re-runnable: every statement uses IF NOT EXISTS / OR REPLACE where possible
-- so you can edit + re-run safely during development.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS guests (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  cast_type   text NOT NULL DEFAULT 'regular_cast'
              CHECK (cast_type IN ('regular_cast', 'special_guest')),
  avatar_url  text,                                -- public URL of uploaded avatar (Supabase Storage)
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Idempotent column adjustments for projects predating later phases.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS cast_type text NOT NULL DEFAULT 'regular_cast';
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_cast_type_check;
ALTER TABLE guests ADD CONSTRAINT guests_cast_type_check
  CHECK (cast_type IN ('regular_cast', 'special_guest'));
ALTER TABLE guests DROP COLUMN IF EXISTS aliases;
ALTER TABLE guests DROP COLUMN IF EXISTS is_resident;

CREATE TABLE IF NOT EXISTS videos (
  id            text PRIMARY KEY,
  title         text NOT NULL,
  bilibili_url  text NOT NULL,
  published_at  date NOT NULL,
  duration_sec  integer,
  thumbnail_url text,                              -- public URL of cover image (Supabase Storage)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Idempotent column adjustments for projects predating later phases.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE videos DROP COLUMN IF EXISTS description;

-- M2M join: which guests appeared in which videos.
-- Canonical store; the frontend rehydrates it onto Video.guestIds for read use.
CREATE TABLE IF NOT EXISTS video_guests (
  video_id  text NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  guest_id  text NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, guest_id)
);

CREATE INDEX IF NOT EXISTS video_guests_guest_id_idx ON video_guests(guest_id);
CREATE INDEX IF NOT EXISTS videos_published_at_idx ON videos(published_at DESC);

-- People allowed to write data. user_id ties to Supabase Auth.
CREATE TABLE IF NOT EXISTS admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  name       text,
  added_at   timestamptz NOT NULL DEFAULT now(),
  added_by   uuid REFERENCES auth.users(id)
);

-- Audit log. Filled exclusively by the trigger below — clients never write
-- to this table directly (RLS denies it).
DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS audit_log (
  id              bigserial PRIMARY KEY,
  video_id        text NOT NULL,
  action          audit_action NOT NULL,
  admin_user_id   uuid,                 -- null for service-role / seed inserts
  admin_email     text NOT NULL,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  diff            jsonb
);

CREATE INDEX IF NOT EXISTS audit_log_video_id_idx        ON audit_log(video_id);
CREATE INDEX IF NOT EXISTS audit_log_occurred_at_idx     ON audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_admin_user_id_idx   ON audit_log(admin_user_id);

-- ----------------------------------------------------------------------------
-- 2. Helper functions
-- ----------------------------------------------------------------------------

-- is_admin() — does the current authenticated user have admin rights?
-- SECURITY DEFINER lets it read `admins` even when the caller can't.
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid());
  $$;

-- Returns video IDs that contain *all* of the supplied guest IDs.
-- Used by the dashboard's server-side guest AND filter — PostgREST can't
-- express the HAVING COUNT trick directly, so we keep it in SQL.
CREATE OR REPLACE FUNCTION videos_with_all_guests(gids text[])
RETURNS TABLE (video_id text)
LANGUAGE sql STABLE
AS $$
  SELECT vg.video_id FROM video_guests vg
  WHERE vg.guest_id = ANY(gids)
  GROUP BY vg.video_id
  HAVING COUNT(DISTINCT vg.guest_id) = array_length(gids, 1);
$$;

-- Audit trigger: writes one row to audit_log per video INSERT/UPDATE/DELETE.
-- SECURITY DEFINER + postgres ownership lets it bypass audit_log RLS.
CREATE OR REPLACE FUNCTION log_video_change()
  RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_action     audit_action;
  v_video_id   text;
  v_diff       jsonb;
  v_email      text;
BEGIN
  -- Skip audit for service_role / seed context (no auth.uid() set).
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_video_id := NEW.id;
    v_diff := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_video_id := NEW.id;
    v_diff := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_video_id := OLD.id;
    v_diff := to_jsonb(OLD);
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO audit_log (video_id, action, admin_user_id, admin_email, diff)
  VALUES (v_video_id, v_action, auth.uid(), coalesce(v_email, 'unknown'), v_diff);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS videos_audit_trigger ON videos;
CREATE TRIGGER videos_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON videos
  FOR EACH ROW EXECUTE FUNCTION log_video_change();

-- Auto-update videos.updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS videos_set_updated_at ON videos;
CREATE TRIGGER videos_set_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE guests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_guests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;

-- Public read on content tables (viewers don't need to log in).
DROP POLICY IF EXISTS "anyone can read guests"        ON guests;
DROP POLICY IF EXISTS "anyone can read videos"        ON videos;
DROP POLICY IF EXISTS "anyone can read video_guests"  ON video_guests;
CREATE POLICY "anyone can read guests"        ON guests        FOR SELECT USING (true);
CREATE POLICY "anyone can read videos"        ON videos        FOR SELECT USING (true);
CREATE POLICY "anyone can read video_guests"  ON video_guests  FOR SELECT USING (true);

-- Admin-only writes.
DROP POLICY IF EXISTS "admins can write guests"        ON guests;
DROP POLICY IF EXISTS "admins can write videos"        ON videos;
DROP POLICY IF EXISTS "admins can write video_guests"  ON video_guests;
CREATE POLICY "admins can write guests"        ON guests        FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins can write videos"        ON videos        FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins can write video_guests"  ON video_guests  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Admins table — only admins can read/manage admins.
DROP POLICY IF EXISTS "admins can read admins"   ON admins;
DROP POLICY IF EXISTS "admins can insert admins" ON admins;
DROP POLICY IF EXISTS "admins can delete admins" ON admins;
CREATE POLICY "admins can read admins"   ON admins FOR SELECT USING (is_admin());
CREATE POLICY "admins can insert admins" ON admins FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admins can delete admins" ON admins FOR DELETE USING (is_admin());

-- Audit log — admins can read; nobody can write directly (only the trigger).
DROP POLICY IF EXISTS "admins can read audit log" ON audit_log;
CREATE POLICY "admins can read audit log" ON audit_log FOR SELECT USING (is_admin());
-- Note: deliberately NO policy for INSERT/UPDATE/DELETE on audit_log.
-- The SECURITY DEFINER trigger function (owned by postgres) bypasses RLS to
-- write here; clients cannot.

-- ----------------------------------------------------------------------------
-- 4. Role grants
-- ----------------------------------------------------------------------------
-- RLS is the access-control layer, but Postgres ALSO requires table-level
-- privileges before RLS even gets consulted. With newer Supabase API keys
-- the default grants aren't always applied to user-created tables, so we
-- spell them out. RLS policies above still gate what each role can actually
-- do; these grants just ensure the roles can attempt the operations.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON guests, videos, video_guests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guests, videos, video_guests, admins
  TO authenticated;
GRANT SELECT ON audit_log TO authenticated;

-- service_role bypasses RLS (BYPASSRLS attr) but still needs grants.
GRANT ALL ON guests, videos, video_guests, admins, audit_log TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Function execution. Postgres normally grants EXECUTE to PUBLIC by default,
-- but Supabase's newer API key setup doesn't always inherit that — be
-- explicit so the frontend can call is_admin() via supabase.rpc().
GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION videos_with_all_guests(text[])
  TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Storage policies (Phase 5)
-- ----------------------------------------------------------------------------
-- Two buckets, both expected to be marked "Public" in the Supabase dashboard:
--   - guest-avatars     (per-guest profile images)
--   - video-thumbnails  (per-video preview images, used in Phase 6)
-- Public read happens via the bucket's `public` flag; the SELECT policies
-- below are defense-in-depth so authenticated reads also work.

DROP POLICY IF EXISTS "public read guest-avatars" ON storage.objects;
CREATE POLICY "public read guest-avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'guest-avatars');

DROP POLICY IF EXISTS "public read video-thumbnails" ON storage.objects;
CREATE POLICY "public read video-thumbnails"
  ON storage.objects FOR SELECT USING (bucket_id = 'video-thumbnails');

DROP POLICY IF EXISTS "admins insert guest-avatars" ON storage.objects;
CREATE POLICY "admins insert guest-avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'guest-avatars' AND is_admin());

DROP POLICY IF EXISTS "admins update guest-avatars" ON storage.objects;
CREATE POLICY "admins update guest-avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'guest-avatars' AND is_admin())
  WITH CHECK (bucket_id = 'guest-avatars' AND is_admin());

DROP POLICY IF EXISTS "admins delete guest-avatars" ON storage.objects;
CREATE POLICY "admins delete guest-avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'guest-avatars' AND is_admin());

DROP POLICY IF EXISTS "admins insert video-thumbnails" ON storage.objects;
CREATE POLICY "admins insert video-thumbnails"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'video-thumbnails' AND is_admin());

DROP POLICY IF EXISTS "admins update video-thumbnails" ON storage.objects;
CREATE POLICY "admins update video-thumbnails"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'video-thumbnails' AND is_admin())
  WITH CHECK (bucket_id = 'video-thumbnails' AND is_admin());

DROP POLICY IF EXISTS "admins delete video-thumbnails" ON storage.objects;
CREATE POLICY "admins delete video-thumbnails"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'video-thumbnails' AND is_admin());

-- ============================================================================
-- Done. After running, see README in /supabase for the bootstrap-first-admin
-- step (you sign up via the app, then run a tiny INSERT here).
-- ============================================================================
