import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (process.env.NODE_ENV === 'production') {
    if (!url || !key || url.includes('placeholder') || key.includes('placeholder')) {
      throw new Error('[Supabase Server] Missing valid NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in production.');
    }
  }

  const validUrl = url && (url.startsWith('http://') || url.startsWith('https://'))
    ? url
    : 'https://placeholder.supabase.co';
  const validKey = key || 'placeholder-key';

  return createServerClient(validUrl, validKey, {
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
          // Handled safely saat dipanggil dari Server Component
        }
      },
    },
  });
}
