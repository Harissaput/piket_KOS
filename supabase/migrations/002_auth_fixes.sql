-- ============================================================
-- 002_auth_fixes.sql
-- Perbaikan Bug Autentikasi, Unique Constraint Slot Anggota, dan Pengetatan RLS
-- ============================================================

-- 1. FIX BUG SLOT ANGGOTA TERKUNCI OLEH PROFIL STATUS REJECTED
-- Cari dan hapus constraint UNIQUE penuh pada profiles.member_id jika ada
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[(
        SELECT attnum 
        FROM pg_attribute 
        WHERE attrelid = 'public.profiles'::regclass 
          AND attname = 'member_id'
      )]
  ) LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Buat Partial Unique Index yang hanya berlaku saat status 'pending' atau 'approved'
CREATE UNIQUE INDEX IF NOT EXISTS profiles_member_active_uniq 
ON public.profiles(member_id) 
WHERE member_id IS NOT NULL AND status IN ('pending', 'approved');

-- 2. UPDATE TRIGGER handle_new_user() UNTUK MENANGKAP UNIQUE_VIOLATION
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
  -- Ambil metadata
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

    -- Validasi member_id harus ada di members dan status_aktif true
    SELECT EXISTS (
      SELECT 1 FROM public.members
      WHERE id = v_member_id AND status_aktif = true
    ) INTO v_member_exists;

    IF NOT v_member_exists THEN
      RAISE EXCEPTION 'Slot anggota tidak ditemukan atau sudah tidak aktif';
    END IF;

    -- Validasi belum diklaim oleh profil lain yang aktif (pending atau approved)
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

  -- Buat profile dengan default role 'user' dan status 'pending'
  BEGIN
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
  EXCEPTION WHEN unique_violation THEN
    -- Tangkap potensi race condition jika dua akun mendaftar slot yang sama bersamaan
    RAISE EXCEPTION 'Slot anggota ini sudah diklaim oleh akun lain';
  END;

  RETURN NEW;
END;
$$;

-- 3. TUTUP AKSES BACA TABEL MEMBERS OLEH ROLE ANON (GUNAKAN RPC get_unclaimed_members())
DROP POLICY IF EXISTS "members_anon_read" ON public.members;
