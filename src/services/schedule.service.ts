import { createClient } from '@/lib/supabase/client';
import { Member, DaySchedule, ScheduleOverride, ScheduleEpoch } from '@/types/database';
import {
  getDutyMemberForDateWithEpochs,
  getWeeklySchedule as computeWeeklySchedule,
} from '@/lib/algorithms/scheduleRotation';
import { formatLocalDate } from '@/lib/utils/date';

/**
 * Fetch all schedule epochs sorted by effective_from ascending.
 */
export async function getScheduleEpochs(): Promise<ScheduleEpoch[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('schedule_epochs')
      .select('*')
      .order('effective_from', { ascending: true });

    if (error) {
      console.warn('[schedule.service] getScheduleEpochs error:', error.message);
      return [];
    }

    return (data as ScheduleEpoch[]) || [];
  } catch (err) {
    console.warn('[schedule.service] getScheduleEpochs exception:', err);
    return [];
  }
}

/**
 * Fetch schedule overrides for a date range (YYYY-MM-DD).
 */
export async function getOverridesForRange(
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
 * Get which member is on duty TODAY, respecting epochs and overrides.
 * Returns null if today is hari libur piket.
 */
export async function getTodayDutyMember(
  members: Member[],
  startDate: string,
  epochs: ScheduleEpoch[] = [],
  hariLibur: string = 'Minggu'
): Promise<Member | null> {
  const today = new Date();
  const todayStr = formatLocalDate(today);

  const overrides = await getOverridesForRange(todayStr, todayStr);
  const override = overrides.find((o) => o.date === todayStr);

  if (override) {
    if (!override.new_member_id) return null;
    return members.find((m) => m.id === override.new_member_id) || null;
  }

  return getDutyMemberForDateWithEpochs(today, members, epochs, startDate, hariLibur);
}

/**
 * Get full week schedule for a given reference date, merging
 * computed epoch rotation with persisted overrides.
 */
export async function getWeeklySchedule(
  referenceDate: Date,
  members: Member[],
  startDate: string,
  epochs: ScheduleEpoch[] = [],
  hariLibur: string = 'Minggu'
): Promise<DaySchedule[]> {
  const rawSchedule = computeWeeklySchedule(referenceDate, members, startDate, epochs, hariLibur);

  if (rawSchedule.length === 0) return [];

  const rangeStart = rawSchedule[0].dateFormatted;
  const rangeEnd = rawSchedule[rawSchedule.length - 1].dateFormatted;

  const overrides = await getOverridesForRange(rangeStart, rangeEnd);
  const overrideMap = new Map(overrides.map((o) => [o.date, o]));

  return rawSchedule.map((day) => {
    const override = overrideMap.get(day.dateFormatted);

    if (override) {
      const assignedMember = override.new_member_id
        ? members.find((m) => m.id === override.new_member_id) || null
        : null;

      return {
        ...day,
        member: assignedMember,
        override,
      };
    }

    return day;
  });
}
