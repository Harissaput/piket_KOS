# Panduan Migrasi Database KosPiket (Supabase)

Dokumen ini menjelaskan urutan migrasi SQL untuk KosPiket di Supabase SQL Editor.

## Urutan Eksekusi Migrasi

1. **`000_base_schema.sql`**
   - Membuat tabel dasar: `members`, `settings`, `tasks`, `schedule_overrides`, `completion_logs`, `swap_requests`, `kos_rules`.
   - Mengatur replica identity untuk Realtime.
   - Mengaktifkan publication `supabase_realtime` secara aman (idempotent dengan pengecekan `pg_publication_tables`).
   - Menyisipkan seed data anggota (Haris, Fahrul, Ishom), tugas awal, peraturan kos, dan pengaturan default.

2. **`001_auth_roles.sql`**
   - Membuat tabel `public.profiles` yang terhubung dengan `auth.users(id)`.
   - Menambahkan kolom `created_by` pada tabel `schedule_overrides`.
   - Membuat helper functions: `is_admin()`, `is_approved()`, `current_member_id()`.
   - Membuat trigger `handle_new_user` pada `auth.users` untuk membuat profil dengan validasi pemilihan slot anggota.
   - Membuat RPC `get_unclaimed_members()` untuk form pendaftaran.
   - Membuat RPC transaksi atomik `create_swap_request` dan `respond_swap_request`.
   - Menghapus policy `public_all` dan menerapkan Row Level Security (RLS) ketat sesuai peran (User vs Admin).

---

## Langkah Membuat Admin Pertama

1. Buka aplikasi di browser dan lakukan pendaftaran akun baru melalui halaman `/daftar`.
2. Masukkan nama, email, password, dan pilih salah satu slot anggota.
3. Setelah mendaftar, status akun Anda adalah `pending`.
4. Buka **Supabase Dashboard** > **SQL Editor** > **New Query**.
5. Jalankan query berikut:

```sql
UPDATE public.profiles
SET role = 'admin', status = 'approved', approved_at = NOW()
WHERE email = 'email_yang_anda_daftarkan@gmail.com';
```

6. Sekarang Anda bisa login di `/login` dan akan otomatis diarahkan ke Dashboard Admin di `/admin`.

---

## Setelan Supabase Auth yang Perlu Dicek

Di dashboard Supabase:
1. **Authentication > Providers > Email**:
   - Pastikan **Enable Email provider** aktif (`ON`).
   - Jika ingin pengguna bisa langsung login tanpa verifikasi link email, nonaktifkan **Confirm email** (`OFF`).
2. **Authentication > URL Configuration**:
   - **Site URL**: `http://localhost:3000` (atau domain production Anda).
   - **Redirect URLs**: Tambahkan `http://localhost:3000/**` dan URL production.

---

## Menjadwalkan Edge Function `auto-mark-missed` via pg_cron

Untuk menandai piket yang terlewat kemarin secara otomatis setiap tengah malam (jam 00:01 WIB / 17:01 UTC):

```sql
-- Aktifkan ekstensi pg_cron dan pg_net jika belum
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Jadwalkan cron job setiap malam jam 17:01 UTC (00:01 WIB)
SELECT cron.schedule(
  'auto-mark-missed-duty',
  '1 17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/auto-mark-missed',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
  );
  $$
);
```
