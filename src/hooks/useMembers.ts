'use client';

import { useState, useEffect, useCallback } from 'react';
import { Member } from '@/types/database';
import { getMembers, updateMemberAvatar, updateMemberName } from '@/services/member.service';
import { createClient } from '@/lib/supabase/client';

interface UseMembersReturn {
  members: Member[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  handleUpdateAvatar: (memberId: string, avatarUrl: string) => Promise<void>;
  handleUpdateName: (memberId: string, name: string) => Promise<void>;
}

/**
 * Hook for fetching and managing members.
 * Subscribes to Supabase Realtime so all 3 users see avatar/name changes live.
 */
export function useMembers(): UseMembersReturn {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setError(null);
      const data = await getMembers();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data anggota');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();

    // Supabase Realtime — update when any member row changes
    const supabase = createClient();
    const channel = supabase
      .channel(`members-realtime-${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMembers]);

  const handleUpdateAvatar = async (memberId: string, avatarUrl: string) => {
    try {
      const updated = await updateMemberAvatar(memberId, avatarUrl);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? updated : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal update avatar');
      throw err;
    }
  };

  const handleUpdateName = async (memberId: string, name: string) => {
    try {
      const updated = await updateMemberName(memberId, name);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? updated : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal update nama');
      throw err;
    }
  };

  return {
    members,
    isLoading,
    error,
    refetch: fetchMembers,
    handleUpdateAvatar,
    handleUpdateName,
  };
}
