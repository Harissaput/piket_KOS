import { createClient } from '@/lib/supabase/client';
import { Member } from '@/types/database';
import { INITIAL_MEMBERS } from '@/lib/constants/members';

/**
 * Fetch all active members ordered by order_index (Haris=0, Fahrul=1, Ishom=2).
 */
export async function getMembers(): Promise<Member[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('status_aktif', true)
      .order('order_index', { ascending: true });

    if (error || !data || data.length === 0) {
      console.warn('[member.service] getMembers fallback to INITIAL_MEMBERS');
      return INITIAL_MEMBERS;
    }

    return data as Member[];
  } catch (err) {
    console.warn('[member.service] getMembers fallback:', err);
    return INITIAL_MEMBERS;
  }
}

/**
 * Update a member's avatar URL.
 */
export async function updateMemberAvatar(
  memberId: string,
  avatarUrl: string
): Promise<Member> {
  try {
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
  } catch (err) {
    console.warn('[member.service] updateMemberAvatar error:', err);
    const m = INITIAL_MEMBERS.find((item) => item.id === memberId) || INITIAL_MEMBERS[0];
    return { ...m, avatar_url: avatarUrl };
  }
}

/**
 * Update member name.
 */
export async function updateMemberName(
  memberId: string,
  name: string
): Promise<Member> {
  try {
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
  } catch (err) {
    console.warn('[member.service] updateMemberName error:', err);
    const m = INITIAL_MEMBERS.find((item) => item.id === memberId) || INITIAL_MEMBERS[0];
    return { ...m, name };
  }
}
