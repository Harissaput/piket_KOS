'use client';

import { useState, useEffect, useCallback } from 'react';
import { SwapRequest } from '@/types/database';
import {
  getPendingSwapRequests,
  getAllSwapRequests,
  createSwapRequest,
  approveSwapRequest,
  rejectSwapRequest,
} from '@/services/swap.service';
import { createClient } from '@/lib/supabase/client';

export function useSwapRequests() {
  const [pendingRequests, setPendingRequests] = useState<SwapRequest[]>([]);
  const [allRequests, setAllRequests] = useState<SwapRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setError(null);
      const [pending, all] = await Promise.all([
        getPendingSwapRequests(),
        getAllSwapRequests(),
      ]);
      setPendingRequests(pending);
      setAllRequests(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar tukar');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();

    const supabase = createClient();
    const channel = supabase
      .channel(`swaps-realtime-${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'swap_requests' },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequests]);

  const handleCreateRequest = async (payload: {
    targetMemberId: string;
    dateRequester: string;
    dateTarget: string;
  }) => {
    try {
      await createSwapRequest(payload);
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim permintaan tukar');
      throw err;
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await approveSwapRequest(requestId);
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyetujui tukar');
      throw err;
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectSwapRequest(requestId);
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menolak tukar');
      throw err;
    }
  };

  return {
    pendingRequests,
    allRequests,
    isLoading,
    error,
    refetch: fetchRequests,
    handleCreateRequest,
    handleApprove,
    handleReject,
  };
}
