import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Supabase Edge Function: auto-mark-missed
 * Dijadwalkan berjalan setiap malam jam 00:01 WIB via pg_cron.
 * Menggunakan public.effective_duty_on(yesterday) sebagai SATU SUMBER KEBENARAN
 * sehingga hanya petugas yang benar-benar terjadwal yang ditandai terlewat.
 */

function getYesterdayInJakarta(): { dateStr: string; dayOfWeek: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date());
  const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === 'day')!.value, 10);

  const jakartaToday = new Date(Date.UTC(year, month, day));
  const jakartaYesterday = new Date(jakartaToday.getTime() - 24 * 60 * 60 * 1000);
  const dateStr = jakartaYesterday.toISOString().slice(0, 10);
  const dayOfWeek = jakartaYesterday.getUTCDay();

  return { dateStr, dayOfWeek };
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { dateStr: yesterdayStr, dayOfWeek } = getYesterdayInJakarta();

  // 1. Bersihkan permintaan tukar jadwal yang sudah kedaluwarsa
  try {
    await supabase.rpc('expire_outdated_swap_requests');
  } catch (err) {
    console.warn('Gagal memproses expire_outdated_swap_requests:', err);
  }

  // 2. Ambil pengaturan hari libur
  const { data: settings } = await supabase
    .from('settings')
    .select('hari_libur')
    .limit(1)
    .single();

  const hariLibur = settings?.hari_libur || 'Minggu';

  // Jika kemarin hari libur, tidak ada piket
  if (hariLibur === 'Minggu' && dayOfWeek === 0) {
    return new Response(
      JSON.stringify({ message: 'Kemarin adalah hari libur, tidak ada piket.', date: yesterdayStr }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  }

  // 3. Panggil effective_duty_on via RPC untuk mendapatkan ID petugas kemarin
  const { data: scheduledMemberId, error: rpcError } = await supabase.rpc('effective_duty_on', {
    p_date: yesterdayStr,
  });

  if (rpcError) {
    console.error('Error memanggil effective_duty_on:', rpcError);
    return new Response(
      JSON.stringify({ error: rpcError.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  if (!scheduledMemberId) {
    return new Response(
      JSON.stringify({ message: 'Tidak ada petugas terjadwal kemarin.', date: yesterdayStr }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  }

  // 4. Periksa apakah sudah ada log kemarin untuk petugas tersebut
  const { data: existingLogs } = await supabase
    .from('completion_logs')
    .select('id, status')
    .eq('date', yesterdayStr)
    .eq('member_id', scheduledMemberId);

  const hasValidLog = existingLogs?.some(
    (l) => l.status === 'selesai' || l.status === 'izin' || l.status === 'ditukar'
  );

  if (hasValidLog) {
    return new Response(
      JSON.stringify({
        message: 'Petugas kemarin sudah menyelesaikan tugas atau memiliki dispensasi.',
        member_id: scheduledMemberId,
        date: yesterdayStr,
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  }

  // 5. Tandai 'terlewat' secara idempotent (upsert)
  const { error: insertError } = await supabase.from('completion_logs').upsert(
    {
      date: yesterdayStr,
      member_id: scheduledMemberId,
      status: 'terlewat',
      note: 'Otomatis ditandai terlewat oleh sistem',
    },
    { onConflict: 'date,member_id' }
  );

  if (insertError) {
    console.error('Error menandai terlewat:', insertError);
    return new Response(
      JSON.stringify({ error: insertError.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      message: 'Berhasil menandai piket terlewat untuk kemarin.',
      member_id: scheduledMemberId,
      date: yesterdayStr,
    }),
    { headers: { 'Content-Type': 'application/json' }, status: 200 }
  );
});
