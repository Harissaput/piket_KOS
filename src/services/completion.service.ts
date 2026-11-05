import { createClient } from '@/lib/supabase/client';
import { CompletionLog, MemberStatus } from '@/types/database';

interface LogFilters {
  memberId?: string;
  startDate?: string;
  endDate?: string;
}

export async function getCompletionLogs(
  filters: LogFilters = {}
): Promise<CompletionLog[]> {
  const supabase = createClient();
  let query = supabase
    .from('completion_logs')
    .select('*, member:members(*)')
    .order('date', { ascending: false });

  if (filters.memberId) {
    query = query.eq('member_id', filters.memberId);
  }
  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('[completion.service] getCompletionLogs error:', error.message);
    return [];
  }

  return (data as CompletionLog[]) || [];
}

/**
 * Upsert a completion log with status, completed_tasks array, and note.
 */
export async function upsertCompletionLog(
  memberId: string,
  date: string,
  status: MemberStatus,
  completedTasks: string[] = [],
  note?: string
): Promise<CompletionLog> {
  const supabase = createClient();
  const payload = {
    member_id: memberId,
    date,
    status,
    completed_tasks: completedTasks,
    note: note || null,
    completed_at: status === 'selesai' ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('completion_logs')
    .upsert(payload, { onConflict: 'date,member_id' })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Gagal menyimpan status piket');
  }

  return data as CompletionLog;
}

/**
 * Get log for a specific member and date.
 */
export async function getLogForDate(
  memberId: string,
  date: string
): Promise<CompletionLog | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('completion_logs')
      .select('*')
      .eq('member_id', memberId)
      .eq('date', date)
      .maybeSingle();

    if (error) return null;
    return data as CompletionLog | null;
  } catch {
    return null;
  }
}
