import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (process.env.NODE_ENV === 'production') {
    if (!url || !key || url.includes('placeholder') || key.includes('placeholder')) {
      throw new Error('[Supabase Client] Missing valid NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in production.');
    }
  }

  const validUrl = url && (url.startsWith('http://') || url.startsWith('https://'))
    ? url
    : 'https://placeholder.supabase.co';
  const validKey = key || 'placeholder-key';

  return createBrowserClient(validUrl, validKey);
}
