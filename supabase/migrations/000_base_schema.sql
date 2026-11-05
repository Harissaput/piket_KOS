-- ============================================================
-- 000_base_schema.sql
-- KosPiket Base Schema (Idempotent)
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

-- 8. REPLICA IDENTITY
ALTER TABLE public.members REPLICA IDENTITY FULL;
ALTER TABLE public.settings REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.schedule_overrides REPLICA IDENTITY FULL;
ALTER TABLE public.completion_logs REPLICA IDENTITY FULL;
ALTER TABLE public.swap_requests REPLICA IDENTITY FULL;
ALTER TABLE public.kos_rules REPLICA IDENTITY FULL;

-- 9. SUPABASE REALTIME PUBLICATION SETUP (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['members', 'settings', 'tasks', 'schedule_overrides', 'completion_logs', 'swap_requests', 'kos_rules'];
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

-- 10. SEED DATA (Idempotent)
-- 10. SEED DATA (Idempotent, aman dijalankan berulang)

INSERT INTO public.members (name, order_index, avatar_url, avatar_color, status_aktif)
SELECT v.name, v.order_index, v.avatar_url, v.avatar_color, true
FROM (VALUES
  ('Haris',  0, 'https://api.dicebear.com/7.x/avataaars/svg?seed=Haris&top=shortHair&hairColor=black&facialHair[]=beardLight&skinColor=tanned', '#a855f7'),
  ('Fahrul', 1, 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fahrul&top=shortCurly&hairColor=brown&skinColor=light', '#3b82f6'),
  ('Ishom',  2, 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ishom&top=shortFlat&hairColor=black&skinColor=yellow', '#10b981')
) AS v(name, order_index, avatar_url, avatar_color)
WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.order_index = v.order_index);

INSERT INTO public.settings (nama_kost, start_date, hari_libur)
SELECT 'Kos Merdeka', '2026-08-31', 'Minggu'
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

INSERT INTO public.tasks (name, applies_to_day, is_active, sort_order)
SELECT v.name, v.applies_to_day, true, v.sort_order
FROM (VALUES
  ('Sapu & Pel Ruang Bersama',   NULL::text, 1),
  ('Buang Sampah',               NULL::text, 2),
  ('Bersihkan Kamar Mandi Umum', 'Sabtu',    3)
) AS v(name, applies_to_day, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.name = v.name);

INSERT INTO public.kos_rules (content, sort_order)
SELECT v.content, v.sort_order
FROM (VALUES
  ('Piket wajib selesai sebelum jam 08.00 WIB', 1),
  ('Sampah dibuang ke tempat sampah utama setiap hari', 2),
  ('Matikan lampu & alat listrik setelah selesai piket', 3)
) AS v(content, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.kos_rules r WHERE r.content = v.content);