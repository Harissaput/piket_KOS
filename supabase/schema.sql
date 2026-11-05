-- ============================================================
-- KosPiket Master Database Schema & Realtime Setup (Unified & Idempotent)
-- ============================================================

-- 1. TABEL members
CREATE TABLE IF NOT EXISTS public.members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  order_index  INTEGER NOT NULL UNIQUE CHECK (order_index IN (0, 1, 2)),
  avatar_url   TEXT,
  avatar_color TEXT NOT NULL DEFAULT '#a855f7',
  status_aktif BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABEL settings
CREATE TABLE IF NOT EXISTS public.settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_kost   TEXT NOT NULL DEFAULT 'Kos Merdeka',
  start_date  DATE NOT NULL DEFAULT '2026-08-31',
  hari_libur  TEXT NOT NULL DEFAULT 'Minggu'
);

-- 3. TABEL tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  applies_to_day  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- 4. TABEL schedule_overrides
CREATE TABLE IF NOT EXISTS public.schedule_overrides (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date               DATE NOT NULL,
  original_member_id UUID NOT NULL REFERENCES public.members(id),
  new_member_id      UUID REFERENCES public.members(id),
  reason             TEXT NOT NULL CHECK (reason IN ('swap', 'izin', 'manual')),
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS schedule_overrides_date_idx ON public.schedule_overrides(date);

-- 5. TABEL completion_logs
CREATE TABLE IF NOT EXISTS public.completion_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  member_id       UUID NOT NULL REFERENCES public.members(id),
  status          TEXT NOT NULL CHECK (status IN ('belum', 'selesai', 'terlewat', 'izin', 'ditukar')),
  completed_tasks TEXT[] DEFAULT '{}',
  completed_at    TIMESTAMPTZ,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date, member_id)
);

CREATE INDEX IF NOT EXISTS completion_logs_date_idx ON public.completion_logs(date);
CREATE INDEX IF NOT EXISTS completion_logs_member_idx ON public.completion_logs(member_id);

-- 6. TABEL swap_requests
CREATE TABLE IF NOT EXISTS public.swap_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id     UUID NOT NULL REFERENCES public.members(id),
  target_member_id UUID NOT NULL REFERENCES public.members(id),
  date_requester   DATE NOT NULL,
  date_target      DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABEL kos_rules
CREATE TABLE IF NOT EXISTS public.kos_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT NOT NULL UNIQUE,
  sort_order  BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABEL profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id   UUID UNIQUE REFERENCES public.members(id) ON DELETE SET NULL,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_member_idx ON public.profiles(member_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles(status);

-- Foreign key on schedule_overrides.created_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'schedule_overrides_created_by_fkey'
  ) THEN
    ALTER TABLE public.schedule_overrides 
      ADD CONSTRAINT schedule_overrides_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES public.profiles(id);
  END IF;
END $$;

-- 9. REPLICA IDENTITY
ALTER TABLE public.members REPLICA IDENTITY FULL;
ALTER TABLE public.settings REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.schedule_overrides REPLICA IDENTITY FULL;
ALTER TABLE public.completion_logs REPLICA IDENTITY FULL;
ALTER TABLE public.swap_requests REPLICA IDENTITY FULL;
ALTER TABLE public.kos_rules REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- 10. REALTIME PUBLICATION SETUP
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['members', 'settings', 'tasks', 'schedule_overrides', 'completion_logs', 'swap_requests', 'kos_rules', 'profiles'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

-- 11. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT member_id FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- 12. TRIGGER ON auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_full_name TEXT;
  v_member_exists BOOLEAN;
  v_already_claimed BOOLEAN;
BEGIN
  v_full_name := NEW.raw_user_meta_data->>'full_name';
  IF v_full_name IS NULL OR trim(v_full_name) = '' THEN
    v_full_name := coalesce(split_part(NEW.email, '@', 1), 'Pengguna');
  END IF;

  IF NEW.raw_user_meta_data->>'member_id' IS NOT NULL AND NEW.raw_user_meta_data->>'member_id' <> '' THEN
    BEGIN
      v_member_id := (NEW.raw_user_meta_data->>'member_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'ID Anggota tidak valid';
    END;

    SELECT EXISTS (
      SELECT 1 FROM public.members
      WHERE id = v_member_id AND status_aktif = true
    ) INTO v_member_exists;

    IF NOT v_member_exists THEN
      RAISE EXCEPTION 'Slot anggota tidak ditemukan atau sudah tidak aktif';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE member_id = v_member_id
        AND status IN ('pending', 'approved')
    ) INTO v_already_claimed;

    IF v_already_claimed THEN
      RAISE EXCEPTION 'Slot anggota ini sudah diklaim oleh akun lain';
    END IF;
  ELSE
    v_member_id := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    member_id,
    full_name,
    email,
    role,
    status,
    created_at
  ) VALUES (
    NEW.id,
    v_member_id,
    v_full_name,
    NEW.email,
    'user',
    'pending',
    NOW()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. RPCs
CREATE OR REPLACE FUNCTION public.get_unclaimed_members()
RETURNS TABLE (
  id UUID,
  name TEXT,
  avatar_url TEXT,
  avatar_color TEXT,
  order_index INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    m.id,
    m.name,
    m.avatar_url,
    m.avatar_color,
    m.order_index
  FROM public.members m
  WHERE m.status_aktif = true
    AND m.id NOT IN (
      SELECT p.member_id 
      FROM public.profiles p 
      WHERE p.member_id IS NOT NULL 
        AND p.status IN ('pending', 'approved')
    )
  ORDER BY m.order_index ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_unclaimed_members() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_swap_request(
  p_target_member_id UUID,
  p_date_requester DATE,
  p_date_target DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req_member_id UUID;
  v_target_exists BOOLEAN;
  v_settings RECORD;
  v_res RECORD;
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Akun Anda belum disetujui untuk membuat permintaan tukar';
  END IF;

  v_req_member_id := public.current_member_id();
  IF v_req_member_id IS NULL THEN
    RAISE EXCEPTION 'Akun Anda tidak terhubung dengan anggota piket';
  END IF;

  IF v_req_member_id = p_target_member_id THEN
    RAISE EXCEPTION 'Pengaju dan anggota tujuan tukar tidak boleh sama';
  END IF;

  IF p_date_requester = p_date_target THEN
    RAISE EXCEPTION 'Tanggal piket yang ditukar tidak boleh sama';
  END IF;

  IF p_date_requester < CURRENT_DATE OR p_date_target < CURRENT_DATE THEN
    RAISE EXCEPTION 'Tanggal piket tidak boleh di masa lalu';
  END IF;

  SELECT hari_libur INTO v_settings FROM public.settings LIMIT 1;
  IF v_settings.hari_libur = 'Minggu' THEN
    IF EXTRACT(DOW FROM p_date_requester) = 0 OR EXTRACT(DOW FROM p_date_target) = 0 THEN
      RAISE EXCEPTION 'Tidak dapat menukar jadwal pada hari libur (Minggu)';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.members WHERE id = p_target_member_id AND status_aktif = true
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'Anggota tujuan tidak ditemukan atau tidak aktif';
  END IF;

  INSERT INTO public.swap_requests (
    requester_id,
    target_member_id,
    date_requester,
    date_target,
    status
  ) VALUES (
    v_req_member_id,
    p_target_member_id,
    p_date_requester,
    p_date_target,
    'pending'
  )
  RETURNING * INTO v_res;

  RETURN to_jsonb(v_res);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_swap_request(UUID, DATE, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_swap_request(
  p_request_id UUID,
  p_approve BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_is_target BOOLEAN;
  v_is_adm BOOLEAN;
  v_curr_member UUID;
BEGIN
  SELECT * INTO v_req FROM public.swap_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permintaan tukar tidak ditemukan';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Permintaan ini sudah diproses sebelumnya (%)', v_req.status;
  END IF;

  v_curr_member := public.current_member_id();
  v_is_adm := public.is_admin();
  v_is_target := (v_curr_member = v_req.target_member_id);

  IF NOT (v_is_target OR v_is_adm) THEN
    RAISE EXCEPTION 'Hanya anggota tujuan atau admin yang dapat menyetujui/menolak permintaan ini';
  END IF;

  IF p_approve THEN
    UPDATE public.swap_requests
    SET status = 'approved'
    WHERE id = p_request_id;

    INSERT INTO public.schedule_overrides (
      date,
      original_member_id,
      new_member_id,
      reason,
      created_by
    ) VALUES 
      (v_req.date_requester, v_req.requester_id, v_req.target_member_id, 'swap', auth.uid()),
      (v_req.date_target, v_req.target_member_id, v_req.requester_id, 'swap', auth.uid());
  ELSE
    UPDATE public.swap_requests
    SET status = 'rejected'
    WHERE id = p_request_id;
  END IF;

  SELECT * INTO v_req FROM public.swap_requests WHERE id = p_request_id;
  RETURN to_jsonb(v_req);
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_swap_request(UUID, BOOLEAN) TO authenticated;

-- 14. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completion_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swap_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kos_rules          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_all" ON public.members;
DROP POLICY IF EXISTS "public_all" ON public.settings;
DROP POLICY IF EXISTS "public_all" ON public.tasks;
DROP POLICY IF EXISTS "public_all" ON public.schedule_overrides;
DROP POLICY IF EXISTS "public_all" ON public.completion_logs;
DROP POLICY IF EXISTS "public_all" ON public.swap_requests;
DROP POLICY IF EXISTS "public_all" ON public.kos_rules;
DROP POLICY IF EXISTS "public_all" ON public.profiles;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "members_select" ON public.members;
CREATE POLICY "members_select" ON public.members
  FOR SELECT TO authenticated
  USING (public.is_approved());

DROP POLICY IF EXISTS "members_anon_read" ON public.members;
CREATE POLICY "members_anon_read" ON public.members
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "members_admin_all" ON public.members;
CREATE POLICY "members_admin_all" ON public.members
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "settings_select" ON public.settings;
CREATE POLICY "settings_select" ON public.settings
  FOR SELECT TO authenticated
  USING (public.is_approved());

DROP POLICY IF EXISTS "settings_admin_all" ON public.settings;
CREATE POLICY "settings_admin_all" ON public.settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT TO authenticated
  USING (public.is_approved());

DROP POLICY IF EXISTS "tasks_admin_all" ON public.tasks;
CREATE POLICY "tasks_admin_all" ON public.tasks
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "kos_rules_select" ON public.kos_rules;
CREATE POLICY "kos_rules_select" ON public.kos_rules
  FOR SELECT TO authenticated
  USING (public.is_approved());

DROP POLICY IF EXISTS "kos_rules_admin_all" ON public.kos_rules;
CREATE POLICY "kos_rules_admin_all" ON public.kos_rules
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "schedule_overrides_select" ON public.schedule_overrides;
CREATE POLICY "schedule_overrides_select" ON public.schedule_overrides
  FOR SELECT TO authenticated
  USING (public.is_approved());

DROP POLICY IF EXISTS "schedule_overrides_admin_write" ON public.schedule_overrides;
CREATE POLICY "schedule_overrides_admin_write" ON public.schedule_overrides
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "completion_logs_select" ON public.completion_logs;
CREATE POLICY "completion_logs_select" ON public.completion_logs
  FOR SELECT TO authenticated
  USING (public.is_approved());

DROP POLICY IF EXISTS "completion_logs_insert" ON public.completion_logs;
CREATE POLICY "completion_logs_insert" ON public.completion_logs
  FOR INSERT TO authenticated
  WITH CHECK (member_id = public.current_member_id() OR public.is_admin());

DROP POLICY IF EXISTS "completion_logs_update" ON public.completion_logs;
CREATE POLICY "completion_logs_update" ON public.completion_logs
  FOR UPDATE TO authenticated
  USING (member_id = public.current_member_id() OR public.is_admin())
  WITH CHECK (member_id = public.current_member_id() OR public.is_admin());

DROP POLICY IF EXISTS "completion_logs_delete" ON public.completion_logs;
CREATE POLICY "completion_logs_delete" ON public.completion_logs
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "swap_requests_select" ON public.swap_requests;
CREATE POLICY "swap_requests_select" ON public.swap_requests
  FOR SELECT TO authenticated
  USING (public.is_approved());

DROP POLICY IF EXISTS "swap_requests_admin_all" ON public.swap_requests;
CREATE POLICY "swap_requests_admin_all" ON public.swap_requests
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 15. SEED DATA (Idempotent)
INSERT INTO public.members (name, order_index, avatar_url, avatar_color, status_aktif)
VALUES
  ('Haris',  0, 'https://api.dicebear.com/7.x/avataaars/svg?seed=Haris&top=shortHair&hairColor=black&facialHair[]=beardLight&skinColor=tanned', '#a855f7', true),
  ('Fahrul', 1, 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fahrul&top=shortCurly&hairColor=brown&skinColor=light', '#3b82f6', true),
  ('Ishom',  2, 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ishom&top=shortFlat&hairColor=black&skinColor=yellow', '#10b981', true)
ON CONFLICT (order_index) DO NOTHING;

INSERT INTO public.settings (nama_kost, start_date, hari_libur)
SELECT 'Kos Merdeka', '2026-08-31', 'Minggu'
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

INSERT INTO public.tasks (name, applies_to_day, is_active, sort_order)
VALUES
  ('Sapu & Pel Ruang Bersama', NULL,    true, 1),
  ('Buang Sampah',             NULL,    true, 2),
  ('Bersihkan Kamar Mandi Umum', 'Sabtu', true, 3)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.kos_rules (content, sort_order)
VALUES
  ('Piket wajib selesai sebelum jam 08.00 WIB', 1),
  ('Sampah dibuang ke tempat sampah utama setiap hari', 2),
  ('Matikan lampu & alat listrik setelah selesai piket', 3)
ON CONFLICT (content) DO NOTHING;

-- ============================================================
-- PETUNJUK MEMBUAT ADMIN PERTAMA:
-- UPDATE public.profiles
-- SET role = 'admin', status = 'approved', approved_at = NOW()
-- WHERE email = 'EMAIL_ANDA_DISINI';
-- ============================================================
