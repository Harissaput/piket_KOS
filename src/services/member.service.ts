import { createClient } from '@/lib/supabase/client';
import { Member } from '@/types/database';

/**
 * Fetch all active members ordered by order_index (Haris=0, Fahrul=1, Ishom=2).
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
 * Update a member's avatar URL.
 */
export async function updateMemberAvatar(
  memberId: string,
  avatarUrl: string
): Promise<Member> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('members')
    .update({ avatar_url: avatarUrl })
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
    .update({ name })
    .eq('id', memberId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Gagal update nama');
  }

  return data as Member;
}
