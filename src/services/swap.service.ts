import { createClient } from '@/lib/supabase/client';
import { SwapRequest, ScheduleOverride } from '@/types/database';
import { getMembers } from './member.service';

const LOCAL_STORAGE_SWAPS_KEY = 'kospiket_swap_requests';
const LOCAL_STORAGE_OVERRIDES_KEY = 'kospiket_schedule_overrides';

function getLocalSwaps(): SwapRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SWAPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSwaps(swaps: SwapRequest[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_SWAPS_KEY, JSON.stringify(swaps));
  } catch {}
}

function saveLocalOverrides(overrides: ScheduleOverride[]) {
  if (typeof window === 'undefined') return;
  try {
    const existingRaw = localStorage.getItem(LOCAL_STORAGE_OVERRIDES_KEY);
    const existing: ScheduleOverride[] = existingRaw ? JSON.parse(existingRaw) : [];
    localStorage.setItem(LOCAL_STORAGE_OVERRIDES_KEY, JSON.stringify([...overrides, ...existing]));
  } catch {}
}

export async function createSwapRequest(payload: {
  requesterId: string;
  targetMemberId: string;
  dateRequester: string;
  dateTarget: string;
}): Promise<SwapRequest> {
  let created: SwapRequest;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('swap_requests')
      .insert({
        requester_id: payload.requesterId,
        target_member_id: payload.targetMemberId,
        date_requester: payload.dateRequester,
        date_target: payload.dateTarget,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || 'Gagal menyimpan ke Supabase');
    created = data as SwapRequest;
  } catch (err) {
    console.warn('[swap.service] createSwapRequest fallback to local:', err);
    created = {
      id: `swap-${Date.now()}`,
      requester_id: payload.requesterId,
      target_member_id: payload.targetMemberId,
      date_requester: payload.dateRequester,
      date_target: payload.dateTarget,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
  }

  // Also store in local storage fallback
  const localList = getLocalSwaps();
  saveLocalSwaps([created, ...localList.filter((s) => s.id !== created.id)]);

  return created;
}

export async function approveSwapRequest(requestId: string): Promise<void> {
  try {
    const supabase = createClient();
    const { data: request } = await supabase
      .from('swap_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    let swap: SwapRequest | null = (request as SwapRequest) || null;

    if (!swap) {
      const localList = getLocalSwaps();
      swap = localList.find((s) => s.id === requestId) || null;
    }

    if (swap) {
      // 1. Update swap status to approved
      await supabase.from('swap_requests').update({ status: 'approved' }).eq('id', requestId);

      // 2. Create schedule overrides for both dates
      const override1 = {
        date: swap.date_requester,
        original_member_id: swap.requester_id,
        new_member_id: swap.target_member_id,
        reason: 'swap' as const,
      };
      const override2 = {
        date: swap.date_target,
        original_member_id: swap.target_member_id,
        new_member_id: swap.requester_id,
        reason: 'swap' as const,
      };

      const { error: overrideErr } = await supabase
        .from('schedule_overrides')
        .insert([override1, override2]);

      if (overrideErr) {
        console.warn('[swap.service] schedule_overrides insert error:', overrideErr.message);
      }

      saveLocalOverrides([
        { ...override1, id: `ov-${Date.now()}-1`, created_at: new Date().toISOString() },
        { ...override2, id: `ov-${Date.now()}-2`, created_at: new Date().toISOString() },
      ]);
    }
  } catch (err) {
    console.warn('[swap.service] approveSwapRequest error:', err);
  }

  const localList = getLocalSwaps();
  const updated = localList.map((s) => (s.id === requestId ? { ...s, status: 'approved' as const } : s));
  saveLocalSwaps(updated);
}

export async function rejectSwapRequest(requestId: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from('swap_requests').update({ status: 'rejected' }).eq('id', requestId);
  } catch (err) {
    console.warn('[swap.service] rejectSwapRequest error:', err);
  }

  const localList = getLocalSwaps();
  const updated = localList.map((s) => (s.id === requestId ? { ...s, status: 'rejected' as const } : s));
  saveLocalSwaps(updated);
}

export async function getPendingSwapRequests(): Promise<SwapRequest[]> {
  const all = await getAllSwapRequests();
  return all.filter((s) => s.status === 'pending');
}

export async function getAllSwapRequests(): Promise<SwapRequest[]> {
  const members = await getMembers();
  const memberMap = new Map(members.map((m) => [m.id, m]));
  let dbSwaps: SwapRequest[] = [];

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('swap_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      dbSwaps = data as SwapRequest[];
    }
  } catch (err) {
    console.warn('[swap.service] getAllSwapRequests db error:', err);
  }

  const localSwaps = getLocalSwaps();
  const combinedMap = new Map<string, SwapRequest>();

  for (const s of localSwaps) {
    combinedMap.set(s.id, s);
  }
  for (const s of dbSwaps) {
    combinedMap.set(s.id, s);
  }

  const combined = Array.from(combinedMap.values()).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  return combined.map((s) => ({
    ...s,
    requester: memberMap.get(s.requester_id) || s.requester,
    target_member: memberMap.get(s.target_member_id) || s.target_member,
  }));
}
