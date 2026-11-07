import { createClient } from '@/lib/supabase/client';
import { Member } from '@/types/database';

/**
 * Fetch all members (both active and inactive) ordered by order_index.
 */
export async function getAllMembers(): Promise<Member[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Gagal mengambil data anggota');
  }

  return (data as Member[]) || [];
}

/**
 * Fetch all active members ordered by order_index.
 */
export async function getMembers(): Promise<Member[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('status_aktif', true)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Gagal mengambil data anggota');
  }

  return (data as Member[]) || [];
}

/**
 * Add a new member via RPC with effective date and new schedule epoch.
 */
export async function addMemberRpc(params: {
  name: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  effectiveFrom?: string; // YYYY-MM-DD
}): Promise<Member> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('add_member', {
    p_name: params.name,
    p_avatar_color: params.avatarColor || '#a855f7',
    p_avatar_url: params.avatarUrl || null,
    p_effective_from: params.effectiveFrom || null,
  });

  if (error) {
    throw new Error(error.message || 'Gagal menambahkan anggota baru');
  }

  return data as Member;
}

/**
 * Deactivate a member via RPC with effective date and new schedule epoch.
 */
export async function deactivateMemberRpc(
  memberId: string,
  effectiveFrom?: string
): Promise<Member> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('deactivate_member', {
    p_member_id: memberId,
    p_effective_from: effectiveFrom || null,
  });

  if (error) {
    throw new Error(error.message || 'Gagal menonaktifkan anggota');
  }

  return data as Member;
}

/**
 * Reactivate a member via RPC with effective date and new schedule epoch.
 */
export async function reactivateMemberRpc(
  memberId: string,
  effectiveFrom?: string
): Promise<Member> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('reactivate_member', {
    p_member_id: memberId,
    p_effective_from: effectiveFrom || null,
  });

  if (error) {
    throw new Error(error.message || 'Gagal mengaktifkan kembali anggota');
  }

  return data as Member;
}

/**
 * Permanently delete member if they have zero history/overrides/swaps.
 */
export async function deleteMemberIfUnused(memberId: string): Promise<void> {
  const supabase = createClient();

  // Check usage in completion_logs
  const { count: logCount } = await supabase
    .from('completion_logs')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId);

  if (logCount && logCount > 0) {
    throw new Error('Anggota ini sudah memiliki riwayat piket. Silakan pilih "Nonaktifkan" alih-alih menghapus.');
  }

  // Check usage in schedule_overrides
  const { count: overrideCount } = await supabase
    .from('schedule_overrides')
    .select('id', { count: 'exact', head: true })
    .or(`original_member_id.eq.${memberId},new_member_id.eq.${memberId}`);

  if (overrideCount && overrideCount > 0) {
    throw new Error('Anggota ini tercatat dalam jadwal pengganti/override. Silakan pilih "Nonaktifkan".');
  }

  // Check usage in swap_requests
  const { count: swapCount } = await supabase
    .from('swap_requests')
    .select('id', { count: 'exact', head: true })
    .or(`requester_id.eq.${memberId},target_member_id.eq.${memberId}`);

  if (swapCount && swapCount > 0) {
    throw new Error('Anggota ini tercatat dalam permintaan tukar jadwal. Silakan pilih "Nonaktifkan".');
  }

  const { error } = await supabase.from('members').delete().eq('id', memberId);
  if (error) {
    throw new Error(error.message || 'Gagal menghapus anggota');
  }
}

/**
 * Update member avatar URL and color.
 */
export async function updateMemberAvatar(
  memberId: string,
  avatarUrl: string,
  avatarColor?: string
): Promise<Member> {
  const supabase = createClient();
  const payload: any = { avatar_url: avatarUrl };
  if (avatarColor) payload.avatar_color = avatarColor;

  const { data, error } = await supabase
    .from('members')
    .update(payload)
    .eq('id', memberId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Gagal update avatar');
  }

  return data as Member;
}

/**
 * Update member name.
 */
export async function updateMemberName(
  memberId: string,
  name: string
): Promise<Member> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('members')
    .update({ name: name.trim() })
    .eq('id', memberId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Gagal update nama');
  }

  return data as Member;
}
