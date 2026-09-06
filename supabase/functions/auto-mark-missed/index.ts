import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Supabase Edge Function: auto-mark-missed
 * Scheduled to run every night at 00:01 via pg_cron.
 * Marks unconfirmed duties from yesterday as 'terlewat'.
 */
Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Yesterday's date YYYY-MM-DD
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Fetch active members & settings
  const { data: members } = await supabase.from('members').select('*').eq('status_aktif', true);
  const { data: settings } = await supabase.from('settings').select('*').single();

  if (!members || !settings) {
    return new Response(JSON.stringify({ message: 'No configuration found' }), { status: 400 });
  }

  // Check if yesterday was marked completed
  const { data: existingLogs } = await supabase
    .from('completion_logs')
    .select('*')
    .eq('date', yesterdayStr);

  const completedMemberIds = new Set(existingLogs?.map((l) => l.member_id));

  // Auto-mark missing duties as 'terlewat'
  for (const member of members) {
    if (!completedMemberIds.has(member.id)) {
      await supabase.from('completion_logs').upsert(
        {
          date: yesterdayStr,
          member_id: member.id,
          status: 'terlewat',
          note: 'Otomatis ditandai terlewat oleh sistem',
        },
        { onConflict: 'date,member_id' }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: true, message: `Auto-mark missed executed for ${yesterdayStr}` }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
