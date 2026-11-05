'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CompletionLog, MemberStatus } from '@/types/database';
import { getCompletionLogs, upsertCompletionLog } from '@/services/completion.service';
import { createClient } from '@/lib/supabase/client';

interface UseCompletionLogsFilters {
  memberId?: string;
  startDate?: string;
  endDate?: string;
}

export function useCompletionLogs(filters: UseCompletionLogsFilters = {}) {
  const [logs, setLogs] = useState<CompletionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { memberId, startDate, endDate } = filters;
  const memoizedFilters = useMemo(
    () => ({ memberId, startDate, endDate }),
    [memberId, startDate, endDate]
  );

  const fetchLogs = useCallback(async () => {
    try {
      setError(null);
      const data = await getCompletionLogs(memoizedFilters);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat riwayat');
    } finally {
      setIsLoading(false);
    }
  }, [memoizedFilters]);

  useEffect(() => {
    fetchLogs();

    const supabase = createClient();
    const channel = supabase
      .channel(`completion-realtime-${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'completion_logs' },
        () => fetchLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  const markStatus = async (
    memberId: string,
    date: string,
    status: MemberStatus,
    completedTasks: string[] = [],
    note?: string
  ) => {
    try {
      const updated = await upsertCompletionLog(memberId, date, status, completedTasks, note);
      setLogs((prev) => [updated, ...prev.filter((l) => !(l.member_id === memberId && l.date === date))]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal update status piket');
      throw err;
    }
  };

  return {
    logs,
    isLoading,
    error,
    refetch: fetchLogs,
    markStatus,
  };
}
