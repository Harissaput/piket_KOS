import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSafeRedirectPath } from '@/lib/utils/safeRedirect';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isProd = process.env.NODE_ENV === 'production';

  const isInvalidConfig =
    !rawUrl ||
    !rawKey ||
    rawUrl.includes('placeholder') ||
    rawKey.includes('placeholder') ||
    (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'));

  // Fail-closed di production jika konfigurasi Supabase tidak valid
  if (isInvalidConfig) {
    if (isProd) {
      console.error('[Middleware] Supabase environment variables are missing or invalid in production.');
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      return NextResponse.redirect(redirectUrl);
    }
    // Hanya boleh bypass saat development lokal tanpa env
    return supabaseResponse;
  }

  const supabase = createServerClient(rawUrl, rawKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isCallback = pathname.startsWith('/auth/');
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/daftar' ||
    pathname === '/lupa-password';
  const isResetPasswordPage = pathname === '/ganti-password';
  const isPendingPage = pathname === '/menunggu-persetujuan';

  // Bug 1 fix: Biarkan rute callback OAuth diproses oleh route handler tanpa interferensi
  if (isCallback) {
    return supabaseResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. User not logged in
  if (!user) {
    if (!isAuthPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      const safeNext = getSafeRedirectPath(pathname, '/');
      if (safeNext !== '/') {
        redirectUrl.searchParams.set('next', safeNext);
      }
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  // Khusus halaman /ganti-password: user harus sudah login (misalnya lewat tautan reset email)
  if (isResetPasswordPage) {
    return supabaseResponse;
  }

  // 2. User is logged in — fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle();

  const status = profile?.status || 'pending';
  const role = profile?.role || 'user';

  // Bug 2 fix: Tangani status rejected tanpa redirect loop
  if (status === 'rejected') {
    // Jalankan signOut agar sesi akun rejected tidak bertahan
    await supabase.auth.signOut();

    if (isAuthPage) {
      return supabaseResponse;
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('error', 'rejected');
    return NextResponse.redirect(redirectUrl);
  }

  // 3. User berstatus pending
  if (status === 'pending') {
    if (!isPendingPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/menunggu-persetujuan';
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  // 4. Approved user
  if (status === 'approved') {
    // Cegah user yang sudah login dan approved mengakses halaman auth / pending
    if (isAuthPage || isPendingPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = role === 'admin' ? '/admin' : '/';
      return NextResponse.redirect(redirectUrl);
    }

    // Role check untuk rute /admin
    if (pathname.startsWith('/admin') && role !== 'admin') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = role === 'admin' ? '/admin' : '/';
      return NextResponse.redirect(redirectUrl);
    }

    // Redirect legacy /pengaturan
    if (pathname === '/pengaturan') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = role === 'admin' ? '/admin/pengaturan' : '/';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
