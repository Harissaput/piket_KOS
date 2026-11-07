import { createClient } from '@/lib/supabase/client';
import { SwapRequest } from '@/types/database';

/**
 * Fetch all swap requests (sorted newest first).
 */
export async function getAllSwapRequests(): Promise<SwapRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('swap_requests')
    .select(`
      *,
      requester:members!requester_id(*),
      target_member:members!target_member_id(*),
      responder:profiles!responded_by(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Gagal mengambil riwayat tukar jadwal');
  }

  return (data as SwapRequest[]) || [];
}

/**
 * Fetch pending swap requests.
 */
export async function getPendingSwapRequests(): Promise<SwapRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('swap_requests')
    .select(`
      *,
      requester:members!requester_id(*),
      target_member:members!target_member_id(*)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Gagal mengambil permintaan tukar');
  }

  return (data as SwapRequest[]) || [];
}

/**
 * Create a new swap request using the secure RPC.
 */
export async function createSwapRequest(params: {
  targetMemberId: string;
  dateRequester: string;
  dateTarget: string;
}): Promise<SwapRequest> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_swap_request', {
    p_target_member_id: params.targetMemberId,
    p_date_requester: params.dateRequester,
    p_date_target: params.dateTarget,
  });

  if (error) {
    throw new Error(error.message || 'Gagal membuat permintaan tukar jadwal');
  }

  return data as SwapRequest;
}

/**
 * Respond (approve/reject) to a swap request using the atomic RPC.
 */
export async function respondSwapRequest(
  requestId: string,
  approve: boolean
): Promise<SwapRequest> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('respond_swap_request', {
    p_request_id: requestId,
    p_approve: approve,
  });

  if (error) {
    throw new Error(error.message || 'Gagal memproses permintaan tukar');
  }

  return data as SwapRequest;
}

/**
 * Cancel a pending swap request using the atomic RPC (requester or admin only).
 */
export async function cancelSwapRequestRpc(requestId: string): Promise<SwapRequest> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('cancel_swap_request', {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(error.message || 'Gagal membatalkan permintaan tukar');
  }

  return data as SwapRequest;
}

export async function approveSwapRequest(requestId: string): Promise<SwapRequest> {
  return respondSwapRequest(requestId, true);
}

export async function rejectSwapRequest(requestId: string): Promise<SwapRequest> {
  return respondSwapRequest(requestId, false);
}
