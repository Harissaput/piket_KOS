import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

  const validUrl = url.startsWith('http://') || url.startsWith('https://')
    ? url
    : 'https://placeholder.supabase.co';

  // If running with placeholder credentials, bypass redirect in dev
  if (validUrl.includes('placeholder')) {
    return supabaseResponse;
  }

  const supabase = createServerClient(validUrl, key, {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === '/login' || pathname === '/daftar';
  const isPendingPage = pathname === '/menunggu-persetujuan';

  // 1. User not logged in
  if (!user) {
    if (!isAuthPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      if (pathname !== '/') {
        redirectUrl.searchParams.set('next', pathname);
      }
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  // 2. User is logged in — fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle();

  // If profile does not exist yet or status is pending
  const status = profile?.status || 'pending';
  const role = profile?.role || 'user';

  if (status === 'rejected') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('error', 'rejected');
    return NextResponse.redirect(redirectUrl);
  }

  if (status === 'pending') {
    if (!isPendingPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/menunggu-persetujuan';
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  // Approved user
  if (status === 'approved') {
    // If trying to access auth pages or pending page
    if (isAuthPage || isPendingPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = role === 'admin' ? '/admin' : '/';
      return NextResponse.redirect(redirectUrl);
    }

    // Role check for /admin routes
    if (pathname.startsWith('/admin') && role !== 'admin') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/';
      return NextResponse.redirect(redirectUrl);
    }

    // Redirect legacy /pengaturan to /admin/pengaturan or /
    if (pathname === '/pengaturan') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = role === 'admin' ? '/admin/pengaturan' : '/';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
