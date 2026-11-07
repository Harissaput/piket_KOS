/**
 * Sanitasi dan validasi path redirect internal untuk mencegah kerentanan Open Redirect.
 * 
 * Aturan:
 * - Mengembalikan path aman yang diawali '/' atau '/' jika tidak valid.
 * - Tidak boleh diawali '//' atau '/\'.
 * - Tidak boleh mengandung karakter '\' atau karakter kontrol / newline.
 * - Tidak boleh mengarahkan kembali ke halaman auth (/login, /daftar, /auth).
 */
export function getSafeRedirectPath(rawPath: string | null | undefined, fallback: string = '/'): string {
  if (!rawPath || typeof rawPath !== 'string') {
    return fallback;
  }

  let decoded = rawPath.trim();

  // Coba decode URI component untuk mencegah bypass encoded seperti %2f%2f
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return fallback;
  }

  // Cek karakter kontrol atau newline
  if (/[\x00-\x1F\x7F\r\n]/.test(decoded)) {
    return fallback;
  }

  // Cek backslash
  if (decoded.includes('\\')) {
    return fallback;
  }

  // Harus diawali '/' tapi tidak boleh '//' atau '/\'
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) {
    return fallback;
  }

  // Jangan izinkan redirect kembali ke alur login / auth
  const lower = decoded.toLowerCase();
  if (
    lower.startsWith('/login') ||
    lower.startsWith('/daftar') ||
    lower.startsWith('/auth') ||
    lower.startsWith('/lupa-password')
  ) {
    return fallback;
  }

  return decoded;
}
