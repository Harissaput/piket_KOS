'use client';

import { useState, useEffect, useCallback } from 'react';
import { Member } from '@/types/database';
import { getMembers } from '@/services/member.service';
import { createClient } from '@/lib/supabase/client';

export interface UseMembersReturn {
  members: Member[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and managing members.
 * Subscribes to Realtime for immediate updates.
 */
export function useMembers(includeInactive: boolean = false): UseMembersReturn {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();
      let query = supabase.from('members').select('*').order('order_index', { ascending: true });
      if (!includeInactive) {
        query = query.eq('status_aktif', true);
      }
      const { data, error: err } = await query;
      if (err) throw err;
      setMembers((data as Member[]) || []);
    } catch (err) {
      console.warn('[useMembers] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Gagal memuat anggota');
    } finally {
      setIsLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    fetchMembers();

    const supabase = createClient();
    const channel = supabase
      .channel(`members-realtime-${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => fetchMembers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMembers]);

  return {
    members,
    isLoading,
    error,
    refetch: fetchMembers,
  };
}
