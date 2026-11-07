import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSafeRedirectPath } from '@/lib/utils/safeRedirect';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next');
  const safeNext = getSafeRedirectPath(rawNext, '/');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Safe in route handler
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Cek profile user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile || profile.status === 'pending') {
          return NextResponse.redirect(new URL('/menunggu-persetujuan', origin));
        }
        if (profile.status === 'rejected') {
          return NextResponse.redirect(new URL('/login?error=rejected', origin));
        }
        if (profile.role === 'admin') {
          // Jika admin memiliki safeNext custom selain '/', ikuti safeNext, jika tidak arahkan ke /admin
          const target = safeNext !== '/' ? safeNext : '/admin';
          return NextResponse.redirect(new URL(target, origin));
        }
      }

      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=oauth', origin));
}
