# KosPiket - Developer Guide

Proyek ini menggunakan **Next.js 14.2.x (App Router)**, **TypeScript**, **Tailwind CSS**, dan **Supabase (@supabase/ssr)**.

Catatan:
- Versi Next.js yang terpasang adalah **14.2.5** standar (App Router). Konvensi route groups `(auth)`, `(user)`, `admin`, Server Components / Client Components berjalan sesuai Next.js 14 standar.
- Jangan menyimpan token atau role di localStorage; seluruh otorisasi ditegakkan via Supabase Auth + RLS di sisi database.
- Script build & lint: `npm run build` dan `npm run lint`.
