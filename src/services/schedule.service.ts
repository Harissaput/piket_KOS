import { createClient } from '@/lib/supabase/client';
import { Member, DaySchedule, ScheduleOverride } from '@/types/database';
import {
  getDutyMemberForDate,
  getWeeklySchedule as computeWeeklySchedule,
} from '@/lib/algorithms/scheduleRotation';
import { formatLocalDate } from '@/lib/utils/date';

/**
 * Fetch schedule overrides for a date range (YYYY-MM-DD).
 */
async function getOverridesForRange(
  startDate: string,
  endDate: string
): Promise<ScheduleOverride[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('schedule_overrides')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      console.warn('[schedule.service] getOverridesForRange error:', error.message);
      return [];
    }

    return (data as ScheduleOverride[]) || [];
  } catch (err) {
    console.warn('[schedule.service] getOverridesForRange exception:', err);
    return [];
  }
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
  const todayStr = formatLocalDate(today);

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
