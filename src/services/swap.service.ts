import { createClient } from '@/lib/supabase/client';
import { SwapRequest } from '@/types/database';
import { getMembers } from './member.service';

/**
 * Create a new swap request via SECURITY DEFINER RPC.
 * Validates dates, requester membership, and target membership on the database side.
 */
export async function createSwapRequest(payload: {
  targetMemberId: string;
  dateRequester: string;
  dateTarget: string;
}): Promise<SwapRequest> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_swap_request', {
    p_target_member_id: payload.targetMemberId,
    p_date_requester: payload.dateRequester,
    p_date_target: payload.dateTarget,
  });

  if (error) {
    throw new Error(error.message || 'Gagal mengirim permintaan tukar jadwal');
  }

  return data as SwapRequest;
}

/**
 * Approve a swap request atomically via SECURITY DEFINER RPC.
 * Creates two schedule_overrides and updates swap_requests status in a single transaction.
 */
export async function approveSwapRequest(requestId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('respond_swap_request', {
    p_request_id: requestId,
    p_approve: true,
  });

  if (error) {
    throw new Error(error.message || 'Gagal menyetujui permintaan tukar jadwal');
  }
}

/**
 * Reject a swap request via SECURITY DEFINER RPC.
 */
export async function rejectSwapRequest(requestId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('respond_swap_request', {
    p_request_id: requestId,
    p_approve: false,
  });

  if (error) {
    throw new Error(error.message || 'Gagal menolak permintaan tukar jadwal');
  }
}

export async function getPendingSwapRequests(): Promise<SwapRequest[]> {
  const all = await getAllSwapRequests();
  return all.filter((s) => s.status === 'pending');
}

export async function getAllSwapRequests(): Promise<SwapRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('swap_requests')
    .select(`
      *,
      requester:members!requester_id(*),
      target_member:members!target_member_id(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Gagal memuat permintaan tukar jadwal');
  }

  return (data as SwapRequest[]) || [];
}
