import { createClient } from '@/lib/supabase/client';
import { Member, DaySchedule, ScheduleOverride } from '@/types/database';
import {
  getDutyMemberForDate,
  getWeeklySchedule as computeWeeklySchedule,
} from '@/lib/algorithms/scheduleRotation';
import { format } from 'date-fns';

/**
 * Fetch schedule overrides for a date range (YYYY-MM-DD).
 */
async function getOverridesForRange(
  startDate: string,
  endDate: string
): Promise<ScheduleOverride[]> {
  let dbOverrides: ScheduleOverride[] = [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('schedule_overrides')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    if (!error && data) {
      dbOverrides = data as ScheduleOverride[];
    }
  } catch (err) {
    console.warn('[schedule.service] getOverridesForRange error:', err);
  }

  let localOverrides: ScheduleOverride[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('kospiket_schedule_overrides');
      if (raw) localOverrides = JSON.parse(raw);
    } catch {}
  }

  const combinedMap = new Map<string, ScheduleOverride>();
  for (const o of localOverrides) {
    if (o.date >= startDate && o.date <= endDate) {
      combinedMap.set(`${o.date}-${o.original_member_id}`, o);
    }
  }
  for (const o of dbOverrides) {
    if (o.date >= startDate && o.date <= endDate) {
      combinedMap.set(`${o.date}-${o.original_member_id}`, o);
    }
  }

  return Array.from(combinedMap.values());
}

/**
 * Get which member is on duty TODAY, respecting any overrides.
 * Returns null if today is hari libur piket.
 */
export async function getTodayDutyMember(
  members: Member[],
  startDate: string
): Promise<Member | null> {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const overrides = await getOverridesForRange(todayStr, todayStr);
  const override = overrides.find((o) => o.date === todayStr);

  if (override) {
    if (!override.new_member_id) return null;
    return members.find((m) => m.id === override.new_member_id) || null;
  }

  return getDutyMemberForDate(today, members, startDate);
}

/**
 * Get full week schedule for a given reference date, merging
 * computed rotation with any persisted overrides.
 */
export async function getWeeklySchedule(
  referenceDate: Date,
  members: Member[],
  startDate: string
): Promise<DaySchedule[]> {
  const rawSchedule = computeWeeklySchedule(referenceDate, members, startDate);

  if (rawSchedule.length === 0) return [];

  const rangeStart = rawSchedule[0].dateFormatted;
  const rangeEnd = rawSchedule[rawSchedule.length - 1].dateFormatted;

  const overrides = await getOverridesForRange(rangeStart, rangeEnd);
  const overrideMap = new Map(overrides.map((o) => [o.date, o]));

  return rawSchedule.map((day) => {
    const override = overrideMap.get(day.dateFormatted);

    if (override) {
      const newMember = override.new_member_id
        ? members.find((m) => m.id === override.new_member_id) || null
        : null;

      return { ...day, member: newMember, override };
    }

    return day;
  });
}
