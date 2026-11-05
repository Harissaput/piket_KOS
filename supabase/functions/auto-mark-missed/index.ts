import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Supabase Edge Function: auto-mark-missed
 * Scheduled to run every night at 00:01 WIB via pg_cron.
 * Calculates exactly which member was scheduled to perform duty yesterday
 * using schedule rotation and overrides, and only marks that person as 'terlewat'
 * if they did not complete or excuse their duty.
 */

const PATTERNS = [
  [1, 4], // Monday (1) & Thursday (4) -> Pattern 0
  [2, 5], // Tuesday (2) & Friday (5) -> Pattern 1
  [3, 6], // Wednesday (3) & Saturday (6) -> Pattern 2
];

function getYesterdayInJakarta(): { dateStr: string; dayOfWeek: number; dateObj: Date } {
  // Format current date in Asia/Jakarta timezone
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

  // Jakarta today at UTC midnight
  const jakartaToday = new Date(Date.UTC(year, month, day));
  // Subtract 1 day for yesterday
  const jakartaYesterday = new Date(jakartaToday.getTime() - 24 * 60 * 60 * 1000);
  const dateStr = jakartaYesterday.toISOString().slice(0, 10);
  const dayOfWeek = jakartaYesterday.getUTCDay(); // 0 = Sun, 1 = Mon ...

  return { dateStr, dayOfWeek, dateObj: jakartaYesterday };
}

function calculateRotationDutyMemberId(
  yesterdayDateStr: string,
  dayOfWeek: number,
  startDateStr: string,
  members: { id: string; order_index: number }[]
): string | null {
  // If Sunday (0), it is a holiday
  if (dayOfWeek === 0) return null;

  // Calculate calendar weeks diff from startDate (Monday of week 0)
  const dTarget = new Date(yesterdayDateStr + 'T00:00:00Z');
  const dStart = new Date(startDateStr + 'T00:00:00Z');
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  const dowTarget = dTarget.getUTCDay();
  const dowStart = dStart.getUTCDay();

  const monTarget = new Date(dTarget.getTime() - ((dowTarget + 6) % 7) * 24 * 60 * 60 * 1000);
  const monStart = new Date(dStart.getTime() - ((dowStart + 6) % 7) * 24 * 60 * 60 * 1000);

  const diffWeeks = Math.floor((monTarget.getTime() - monStart.getTime()) / msPerWeek);
  const weekIndex = ((diffWeeks % 3) + 3) % 3;

  const patternIndex = PATTERNS.findIndex((days) => days.includes(dayOfWeek));
  if (patternIndex === -1) return null;

  const targetOrderIndex = (((patternIndex - weekIndex) % 3) + 3) % 3;
  const targetMember = members.find((m) => m.order_index === targetOrderIndex);

  return targetMember ? targetMember.id : null;
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { dateStr: yesterdayStr, dayOfWeek } = getYesterdayInJakarta();

  // 1. Fetch active members and settings
  const [membersRes, settingsRes] = await Promise.all([
    supabase.from('members').select('id, name, order_index, status_aktif').eq('status_aktif', true),
    supabase.from('settings').select('*').limit(1).single(),
  ]);

  const members = membersRes.data;
  const settings = settingsRes.data;

  if (!members || !settings) {
    return new Response(JSON.stringify({ message: 'Configuration or members not found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check holiday
  if (settings.hari_libur === 'Minggu' && dayOfWeek === 0) {
    return new Response(
      JSON.stringify({ message: `Yesterday (${yesterdayStr}) was holiday (Minggu). Skipped.` }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Check schedule_overrides for yesterday
  const { data: overrides } = await supabase
    .from('schedule_overrides')
    .select('*')
    .eq('date', yesterdayStr)
    .limit(1);

  let scheduledMemberId: string | null = null;

  if (overrides && overrides.length > 0) {
    const override = overrides[0];
    if (override.reason === 'izin' && !override.new_member_id) {
      // Excused without replacement
      scheduledMemberId = null;
    } else {
      scheduledMemberId = override.new_member_id || null;
    }
  } else {
    // Normal rotation
    scheduledMemberId = calculateRotationDutyMemberId(
      yesterdayStr,
      dayOfWeek,
      settings.start_date || '2026-08-31',
      members
    );
  }

  if (!scheduledMemberId) {
    return new Response(
      JSON.stringify({ message: `No member was on duty yesterday (${yesterdayStr}).` }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Check existing completion_logs for scheduled member
  const { data: existingLog } = await supabase
    .from('completion_logs')
    .select('*')
    .eq('date', yesterdayStr)
    .eq('member_id', scheduledMemberId)
    .maybeSingle();

  // If already selesai, izin, or ditukar, do not overwrite!
  if (existingLog && ['selesai', 'izin', 'ditukar'].includes(existingLog.status)) {
    return new Response(
      JSON.stringify({
        message: `Member ${scheduledMemberId} already has valid log status '${existingLog.status}' for ${yesterdayStr}.`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Mark unconfirmed duty as 'terlewat'
  const { error: upsertErr } = await supabase.from('completion_logs').upsert(
    {
      date: yesterdayStr,
      member_id: scheduledMemberId,
      status: 'terlewat',
      note: 'Otomatis ditandai terlewat oleh sistem',
    },
    { onConflict: 'date,member_id' }
  );

  if (upsertErr) {
    return new Response(
      JSON.stringify({ error: upsertErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Duty for member ${scheduledMemberId} on ${yesterdayStr} marked as 'terlewat'.`,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
