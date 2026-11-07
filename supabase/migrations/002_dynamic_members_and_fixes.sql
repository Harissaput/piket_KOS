-- ============================================================
-- 002_dynamic_members_and_fixes.sql
-- KosPiket v2.3: Dynamic Members, Schedule Epochs, Atomic Swaps & RLS Hardening
-- IDEMPOTENT: Aman dijalankan ulang pada database yang sudah berisi data.
-- ============================================================

-- ============================================================
-- 1. ANGGOTA DINAMIS: UBAH CONSTRAINT ORDER_INDEX
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Hapus CHECK constraint lama yang membatasi (0, 1, 2)
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.members'::regclass 
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%order_index%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.members DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Tambahkan CHECK constraint baru (order_index >= 0)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.members'::regclass 
      AND conname = 'members_order_index_non_negative'
  ) THEN
    ALTER TABLE public.members ADD CONSTRAINT members_order_index_non_negative CHECK (order_index >= 0);
  END IF;
END $$;

-- Pastikan UNIQUE order_index tetap ada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.members'::regclass 
      AND contype = 'u'
      AND conname = 'members_order_index_key'
  ) THEN
    ALTER TABLE public.members ADD CONSTRAINT members_order_index_key UNIQUE (order_index);
  END IF;
END $$;

-- ============================================================
-- 2. TABEL SCHEDULE_EPOCHS & REPLICA IDENTITY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.schedule_epochs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from DATE NOT NULL UNIQUE,
  member_order   UUID[] NOT NULL,
  created_by     UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS schedule_epochs_effective_from_idx 
  ON public.schedule_epochs(effective_from DESC);

ALTER TABLE public.schedule_epochs REPLICA IDENTITY FULL;

-- Tambahkan schedule_epochs ke publication Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'schedule_epochs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_epochs;
  END IF;
END $$;

-- RLS untuk schedule_epochs
ALTER TABLE public.schedule_epochs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_epochs_select" ON public.schedule_epochs;
CREATE POLICY "schedule_epochs_select" ON public.schedule_epochs
  FOR SELECT TO authenticated
  USING (public.is_approved());

DROP POLICY IF EXISTS "schedule_epochs_admin_write" ON public.schedule_epochs;
CREATE POLICY "schedule_epochs_admin_write" ON public.schedule_epochs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Inisialisasi Epoch Awal (Idempotent: hanya jika schedule_epochs masih kosong)
DO $$
DECLARE
  v_start_date DATE;
  v_member_order UUID[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schedule_epochs) THEN
    SELECT start_date INTO v_start_date FROM public.settings LIMIT 1;
    IF v_start_date IS NULL THEN
      v_start_date := '2026-08-31'::DATE;
    END IF;

    SELECT ARRAY_AGG(id ORDER BY order_index ASC)
    INTO v_member_order
    FROM public.members
    WHERE status_aktif = true;

    IF v_member_order IS NOT NULL AND array_length(v_member_order, 1) > 0 THEN
      INSERT INTO public.schedule_epochs (effective_from, member_order)
      VALUES (v_start_date, v_member_order)
      ON CONFLICT (effective_from) DO NOTHING;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 3. PERLUASAN SWAP_REQUESTS (STATUS, RESPONDED_AT/BY)
-- ============================================================
-- Tambah kolom responded_at dan responded_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'swap_requests' 
      AND column_name = 'responded_at'
  ) THEN
    ALTER TABLE public.swap_requests ADD COLUMN responded_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'swap_requests' 
      AND column_name = 'responded_by'
  ) THEN
    ALTER TABLE public.swap_requests ADD COLUMN responded_by UUID REFERENCES public.profiles(id);
  END IF;
END $$;

-- Perbarui CHECK constraint status swap_requests: ('pending','approved','rejected','cancelled','expired')
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.swap_requests'::regclass 
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.swap_requests DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.swap_requests 
  ADD CONSTRAINT swap_requests_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired'));

-- ============================================================
-- 4. FUNGSI SQL ROTASI SATU SUMBER KEBENARAN
-- ============================================================

-- duty_member_on(p_date): menghitung petugas piket murni rotasi epoch (sebelum override)
CREATE OR REPLACE FUNCTION public.duty_member_on(p_date DATE)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow INT;
  v_hari_libur TEXT;
  v_epoch RECORD;
  v_member_count INT;
  v_epoch_start DATE;
  v_mon_epoch DATE;
  v_mon_target DATE;
  v_diff_weeks INT;
  v_week_index INT;
  v_pattern_index INT;
  v_target_idx INT;
  v_target_member_id UUID;
  v_day_offset INT;
BEGIN
  -- Cek DOW: 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  v_dow := EXTRACT(DOW FROM p_date)::INT;

  SELECT coalesce(hari_libur, 'Minggu') INTO v_hari_libur FROM public.settings LIMIT 1;
  IF v_hari_libur = 'Minggu' AND v_dow = 0 THEN
    RETURN NULL;
  END IF;

  -- Cari epoch efektif terakhir dengan effective_from <= p_date
  SELECT * INTO v_epoch
  FROM public.schedule_epochs
  WHERE effective_from <= p_date
  ORDER BY effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Fallback ke epoch paling awal jika tanggal sebelum epoch pertama
    SELECT * INTO v_epoch
    FROM public.schedule_epochs
    ORDER BY effective_from ASC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_member_count := array_length(v_epoch.member_order, 1);
  IF v_member_count IS NULL OR v_member_count = 0 THEN
    RETURN NULL;
  END IF;

  v_epoch_start := v_epoch.effective_from;

  -- Jika jumlah anggota tepat 3, gunakan rotasi pola mingguan KosPiket (Senin&Kamis, Selasa&Jumat, Rabu&Sabtu)
  -- Pola ini menjamin kompatibilitas 100% dengan data & riwayat KosPiket v2.0-v2.2
  IF v_member_count = 3 THEN
    -- Pola 0: Senin(1), Kamis(4)
    -- Pola 1: Selasa(2), Jumat(5)
    -- Pola 2: Rabu(3), Sabtu(6)
    IF v_dow IN (1, 4) THEN
      v_pattern_index := 0;
    ELSIF v_dow IN (2, 5) THEN
      v_pattern_index := 1;
    ELSIF v_dow IN (3, 6) THEN
      v_pattern_index := 2;
    ELSE
      RETURN NULL;
    END IF;

    -- Hitung selisih minggu kalender mulai hari Senin
    v_mon_epoch := v_epoch_start - ((EXTRACT(DOW FROM v_epoch_start)::INT + 6) % 7);
    v_mon_target := p_date - ((v_dow + 6) % 7);
    v_diff_weeks := (v_mon_target - v_mon_epoch) / 7;

    v_week_index := ((v_diff_weeks % 3) + 3) % 3;
    v_target_idx := ((v_pattern_index - v_week_index) % 3 + 3) % 3; -- 0, 1, 2

    RETURN v_epoch.member_order[v_target_idx + 1];
  ELSE
    -- Rotasi dinamis untuk N anggota (!= 3):
    -- Menghitung hari kerja aktif (Senin s.d. Sabtu) sejak v_epoch_start
    -- Hari Minggu dilewati jika hari_libur = 'Minggu'
    IF p_date < v_epoch_start THEN
      -- Jika target sebelum epoch start, hitung mundur
      v_day_offset := 0;
      FOR d IN 0..(v_epoch_start - p_date - 1) LOOP
        IF EXTRACT(DOW FROM (p_date + d))::INT <> 0 THEN
          v_day_offset := v_day_offset + 1;
        END IF;
      END LOOP;
      v_target_idx := (((-v_day_offset) % v_member_count) + v_member_count) % v_member_count;
    ELSE
      v_day_offset := 0;
      FOR d IN 0..(p_date - v_epoch_start) LOOP
        IF EXTRACT(DOW FROM (v_epoch_start + d))::INT <> 0 THEN
          IF (v_epoch_start + d) = p_date THEN
            -- Hari target
            NULL;
          ELSE
            v_day_offset := v_day_offset + 1;
          END IF;
        END IF;
      END LOOP;
      v_target_idx := v_day_offset % v_member_count;
    END IF;

    RETURN v_epoch.member_order[v_target_idx + 1];
  END IF;
END;
$$;

-- effective_duty_on(p_date): menerapkan schedule_overrides di atas rotasi
CREATE OR REPLACE FUNCTION public.effective_duty_on(p_date DATE)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override RECORD;
  v_duty UUID;
BEGIN
  SELECT * INTO v_override
  FROM public.schedule_overrides
  WHERE date = p_date
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- new_member_id bisa NULL jika izin tanpa pengganti
    RETURN v_override.new_member_id;
  END IF;

  RETURN public.duty_member_on(p_date);
END;
$$;

-- ============================================================
-- 5. RPC ADMIN: ADD, DEACTIVATE, REACTIVATE MEMBER DENGAN EPOCH
-- ============================================================

-- RPC add_member: Menambahkan slot anggota baru dan mencatat epoch baru
CREATE OR REPLACE FUNCTION public.add_member(
  p_name TEXT,
  p_avatar_color TEXT DEFAULT '#a855f7',
  p_avatar_url TEXT DEFAULT NULL,
  p_effective_from DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_order INT;
  v_new_member_id UUID;
  v_effective_from DATE;
  v_new_order_ids UUID[];
  v_res RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat menambah anggota.';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Nama anggota wajib diisi.';
  END IF;

  IF length(trim(p_name)) > 40 THEN
    RAISE EXCEPTION 'Nama anggota maksimal 40 karakter.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.members WHERE lower(name) = lower(trim(p_name))) THEN
    RAISE EXCEPTION 'Anggota dengan nama "%" sudah ada.', trim(p_name);
  END IF;

  -- Default effective_from: Senin berikutnya jika tidak diisi
  IF p_effective_from IS NULL THEN
    v_effective_from := CURRENT_DATE + ((8 - EXTRACT(DOW FROM CURRENT_DATE)::INT) % 7);
    IF v_effective_from = CURRENT_DATE THEN
      v_effective_from := CURRENT_DATE + 7;
    END IF;
  ELSE
    v_effective_from := p_effective_from;
  END IF;

  IF v_effective_from < CURRENT_DATE THEN
    RAISE EXCEPTION 'Tanggal mulai berlaku tidak boleh di masa lalu.';
  END IF;

  -- Tentukan order_index berikutnya
  SELECT coalesce(max(order_index) + 1, 0) INTO v_next_order FROM public.members;

  INSERT INTO public.members (name, order_index, avatar_color, avatar_url, status_aktif)
  VALUES (trim(p_name), v_next_order, coalesce(p_avatar_color, '#a855f7'), p_avatar_url, true)
  RETURNING id INTO v_new_member_id;

  -- Susun member_order untuk epoch baru (semua anggota aktif)
  SELECT ARRAY_AGG(id ORDER BY order_index ASC)
  INTO v_new_order_ids
  FROM public.members
  WHERE status_aktif = true;

  -- Simpan / update epoch untuk tanggal berlaku tersebut
  INSERT INTO public.schedule_epochs (effective_from, member_order, created_by)
  VALUES (v_effective_from, v_new_order_ids, auth.uid())
  ON CONFLICT (effective_from) 
  DO UPDATE SET member_order = EXCLUDED.member_order, created_by = auth.uid(), created_at = NOW();

  SELECT * INTO v_res FROM public.members WHERE id = v_new_member_id;
  RETURN to_jsonb(v_res);
END;
$$;

-- RPC deactivate_member: Menonaktifkan anggota & mencatat epoch baru
CREATE OR REPLACE FUNCTION public.deactivate_member(
  p_member_id UUID,
  p_effective_from DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count INT;
  v_effective_from DATE;
  v_new_order_ids UUID[];
  v_res RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat menonaktifkan anggota.';
  END IF;

  SELECT count(*) INTO v_active_count FROM public.members WHERE status_aktif = true;
  IF v_active_count <= 2 THEN
    RAISE EXCEPTION 'Tidak dapat menonaktifkan anggota. Rotasi jadwal membutuhkan minimal 2 anggota aktif.';
  END IF;

  IF p_effective_from IS NULL THEN
    v_effective_from := CURRENT_DATE + ((8 - EXTRACT(DOW FROM CURRENT_DATE)::INT) % 7);
    IF v_effective_from = CURRENT_DATE THEN
      v_effective_from := CURRENT_DATE + 7;
    END IF;
  ELSE
    v_effective_from := p_effective_from;
  END IF;

  IF v_effective_from < CURRENT_DATE THEN
    RAISE EXCEPTION 'Tanggal mulai berlaku tidak boleh di masa lalu.';
  END IF;

  UPDATE public.members
  SET status_aktif = false
  WHERE id = p_member_id;

  SELECT ARRAY_AGG(id ORDER BY order_index ASC)
  INTO v_new_order_ids
  FROM public.members
  WHERE status_aktif = true;

  INSERT INTO public.schedule_epochs (effective_from, member_order, created_by)
  VALUES (v_effective_from, v_new_order_ids, auth.uid())
  ON CONFLICT (effective_from) 
  DO UPDATE SET member_order = EXCLUDED.member_order, created_by = auth.uid(), created_at = NOW();

  SELECT * INTO v_res FROM public.members WHERE id = p_member_id;
  RETURN to_jsonb(v_res);
END;
$$;

-- RPC reactivate_member: Mengaktifkan kembali anggota & mencatat epoch baru
CREATE OR REPLACE FUNCTION public.reactivate_member(
  p_member_id UUID,
  p_effective_from DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_from DATE;
  v_new_order_ids UUID[];
  v_res RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat mengaktifkan kembali anggota.';
  END IF;

  IF p_effective_from IS NULL THEN
    v_effective_from := CURRENT_DATE + ((8 - EXTRACT(DOW FROM CURRENT_DATE)::INT) % 7);
    IF v_effective_from = CURRENT_DATE THEN
      v_effective_from := CURRENT_DATE + 7;
    END IF;
  ELSE
    v_effective_from := p_effective_from;
  END IF;

  IF v_effective_from < CURRENT_DATE THEN
    RAISE EXCEPTION 'Tanggal mulai berlaku tidak boleh di masa lalu.';
  END IF;

  UPDATE public.members
  SET status_aktif = true
  WHERE id = p_member_id;

  SELECT ARRAY_AGG(id ORDER BY order_index ASC)
  INTO v_new_order_ids
  FROM public.members
  WHERE status_aktif = true;

  INSERT INTO public.schedule_epochs (effective_from, member_order, created_by)
  VALUES (v_effective_from, v_new_order_ids, auth.uid())
  ON CONFLICT (effective_from) 
  DO UPDATE SET member_order = EXCLUDED.member_order, created_by = auth.uid(), created_at = NOW();

  SELECT * INTO v_res FROM public.members WHERE id = p_member_id;
  RETURN to_jsonb(v_res);
END;
$$;

-- ============================================================
-- 6. PERKUAT CREATE_SWAP_REQUEST & RESPOND_SWAP_REQUEST
-- ============================================================

-- create_swap_request yang divalidasi dengan effective_duty_on()
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
  v_duty_req UUID;
  v_duty_target UUID;
  v_settings RECORD;
  v_res RECORD;
BEGIN
  IF NOT public.is_approved() THEN
    RAISE EXCEPTION 'Akun Anda belum disetujui untuk membuat permintaan tukar.';
  END IF;

  v_req_member_id := public.current_member_id();
  IF v_req_member_id IS NULL THEN
    RAISE EXCEPTION 'Akun Anda tidak terhubung dengan anggota piket.';
  END IF;

  IF v_req_member_id = p_target_member_id THEN
    RAISE EXCEPTION 'Pengaju dan anggota tujuan tukar tidak boleh sama.';
  END IF;

  IF p_date_requester = p_date_target THEN
    RAISE EXCEPTION 'Tanggal piket yang ditukar tidak boleh sama.';
  END IF;

  IF p_date_requester < CURRENT_DATE OR p_date_target < CURRENT_DATE THEN
    RAISE EXCEPTION 'Tanggal piket tidak boleh di masa lalu.';
  END IF;

  -- Cek hari libur
  SELECT coalesce(hari_libur, 'Minggu') as hari_libur INTO v_settings FROM public.settings LIMIT 1;
  IF v_settings.hari_libur = 'Minggu' THEN
    IF EXTRACT(DOW FROM p_date_requester) = 0 OR EXTRACT(DOW FROM p_date_target) = 0 THEN
      RAISE EXCEPTION 'Tidak dapat menukar jadwal pada hari libur (Minggu).';
    END IF;
  END IF;

  -- Pastikan target aktif
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_target_member_id AND status_aktif = true) THEN
    RAISE EXCEPTION 'Anggota tujuan tidak ditemukan atau tidak aktif.';
  END IF;

  -- Validasi jadwal pengaju memang milik pengaju
  v_duty_req := public.effective_duty_on(p_date_requester);
  IF v_duty_req IS NULL OR v_duty_req <> v_req_member_id THEN
    RAISE EXCEPTION 'Tanggal % bukan jadwal piket Anda saat ini.', p_date_requester;
  END IF;

  -- Validasi jadwal target memang milik target
  v_duty_target := public.effective_duty_on(p_date_target);
  IF v_duty_target IS NULL OR v_duty_target <> p_target_member_id THEN
    RAISE EXCEPTION 'Tanggal % bukan jadwal piket anggota tujuan.', p_date_target;
  END IF;

  -- Tolak jika sudah ada swap pending yang melibatkan salah satu tanggal ini
  IF EXISTS (
    SELECT 1 FROM public.swap_requests
    WHERE status = 'pending'
      AND (
        date_requester IN (p_date_requester, p_date_target)
        OR date_target IN (p_date_requester, p_date_target)
      )
  ) THEN
    RAISE EXCEPTION 'Salah satu tanggal piket yang dipilih sudah memiliki permintaan tukar lain yang masih diproses.';
  END IF;

  -- Tolak jika salah satu tanggal sudah memiliki override aktif
  IF EXISTS (
    SELECT 1 FROM public.schedule_overrides
    WHERE date IN (p_date_requester, p_date_target)
  ) THEN
    RAISE EXCEPTION 'Salah satu tanggal piket yang dipilih sudah memiliki jadwal pengganti (override).';
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

-- respond_swap_request dengan validasi ulang atomik
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
  v_duty_req UUID;
  v_duty_target UUID;
BEGIN
  SELECT * INTO v_req FROM public.swap_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permintaan tukar tidak ditemukan.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Permintaan ini sudah diproses sebelumnya (status: %).', v_req.status;
  END IF;

  -- Cek apakah salah satu tanggal sudah lewat -> jika ya, otomatis expired
  IF v_req.date_requester < CURRENT_DATE OR v_req.date_target < CURRENT_DATE THEN
    UPDATE public.swap_requests
    SET status = 'expired', responded_at = NOW(), responded_by = auth.uid()
    WHERE id = p_request_id;
    RAISE EXCEPTION 'Permintaan tukar ini sudah kedaluwarsa karena salah satu tanggalnya telah lewat.';
  END IF;

  v_curr_member := public.current_member_id();
  v_is_adm := public.is_admin();
  v_is_target := (v_curr_member = v_req.target_member_id);

  IF NOT (v_is_target OR v_is_adm) THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya anggota tujuan atau admin yang dapat memproses permintaan ini.';
  END IF;

  IF p_approve THEN
    -- Validasi ulang kondisi jadwal saat ini sebelum menyetujui
    v_duty_req := public.effective_duty_on(v_req.date_requester);
    v_duty_target := public.effective_duty_on(v_req.date_target);

    IF v_duty_req IS NULL OR v_duty_req <> v_req.requester_id THEN
      RAISE EXCEPTION 'Jadwal tanggal % telah berubah dan bukan lagi milik pengaju.', v_req.date_requester;
    END IF;

    IF v_duty_target IS NULL OR v_duty_target <> v_req.target_member_id THEN
      RAISE EXCEPTION 'Jadwal tanggal % telah berubah dan bukan lagi milik anggota tujuan.', v_req.date_target;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.schedule_overrides
      WHERE date IN (v_req.date_requester, v_req.date_target)
    ) THEN
      RAISE EXCEPTION 'Salah satu tanggal telah memiliki override lain.';
    END IF;

    UPDATE public.swap_requests
    SET status = 'approved',
        responded_at = NOW(),
        responded_by = auth.uid()
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
    SET status = 'rejected',
        responded_at = NOW(),
        responded_by = auth.uid()
    WHERE id = p_request_id;
  END IF;

  SELECT * INTO v_req FROM public.swap_requests WHERE id = p_request_id;
  RETURN to_jsonb(v_req);
END;
$$;

-- RPC cancel_swap_request: Hanya pengaju (atau admin), hanya saat status pending
CREATE OR REPLACE FUNCTION public.cancel_swap_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_curr_member UUID;
  v_is_adm BOOLEAN;
BEGIN
  SELECT * INTO v_req FROM public.swap_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permintaan tukar tidak ditemukan.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Hanya permintaan yang berstatus pending yang dapat dibatalkan.';
  END IF;

  v_curr_member := public.current_member_id();
  v_is_adm := public.is_admin();

  IF NOT (v_curr_member = v_req.requester_id OR v_is_adm) THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya pengaju atau admin yang dapat membatalkan permintaan ini.';
  END IF;

  UPDATE public.swap_requests
  SET status = 'cancelled',
      responded_at = NOW(),
      responded_by = auth.uid()
  WHERE id = p_request_id;

  SELECT * INTO v_req FROM public.swap_requests WHERE id = p_request_id;
  RETURN to_jsonb(v_req);
END;
$$;

-- Fungsi pembersih swap yang expired
CREATE OR REPLACE FUNCTION public.expire_outdated_swap_requests()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.swap_requests
  SET status = 'expired',
      responded_at = NOW()
  WHERE status = 'pending'
    AND (date_requester < CURRENT_DATE OR date_target < CURRENT_DATE);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Berikan izin akses RPC
GRANT EXECUTE ON FUNCTION public.duty_member_on(DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.effective_duty_on(DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.add_member(TEXT, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_member(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_member(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_swap_request(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_swap_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_swap_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_outdated_swap_requests() TO authenticated, service_role;
