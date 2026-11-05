'use client';

import { useState, useEffect, useCallback } from 'react';
import { Member, DaySchedule } from '@/types/database';
import {
  getTodayDutyMember,
  getWeeklySchedule,
} from '@/services/schedule.service';
import { createClient } from '@/lib/supabase/client';
import { formatLocalDate } from '@/lib/utils/date';

interface UseScheduleReturn {
  todayMember: Member | null;
  tomorrowMember: Member | null;
  weeklySchedule: DaySchedule[];
  currentWeekDate: Date;
  isLoading: boolean;
  error: string | null;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
}

/**
 * Hook for fetching today's duty member, tomorrow's, and the full week schedule.
 * Subscribes to Realtime so overrides (swaps/izin) reflect immediately.
 */
export function useSchedule(
  members: Member[],
  startDate: string
): UseScheduleReturn {
  const [todayMember, setTodayMember] = useState<Member | null>(null);
  const [tomorrowMember, setTomorrowMember] = useState<Member | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([]);
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (members.length === 0 || !startDate) return;

    try {
      setError(null);

      const [todayDuty, weekly] = await Promise.all([
        getTodayDutyMember(members, startDate),
        getWeeklySchedule(currentWeekDate, members, startDate),
      ]);

      setTodayMember(todayDuty);
      setWeeklySchedule(weekly);

      // Tomorrow's member using formatLocalDate (avoids UTC offset bug)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowFmt = formatLocalDate(tomorrow);
      const tomorrowDay = weekly.find((d) => d.dateFormatted === tomorrowFmt);
      setTomorrowMember(tomorrowDay?.member ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat jadwal');
    } finally {
      setIsLoading(false);
    }
  }, [members, startDate, currentWeekDate]);

  useEffect(() => {
    fetchSchedule();

    const supabase = createClient();
    const channel = supabase
      .channel(`schedule-realtime-${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_overrides' },
        () => fetchSchedule()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSchedule]);

  const goToPrevWeek = () =>
    setCurrentWeekDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });

  const goToNextWeek = () =>
    setCurrentWeekDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });

  return {
    todayMember,
    tomorrowMember,
    weeklySchedule,
    currentWeekDate,
    isLoading,
    error,
    goToPrevWeek,
    goToNextWeek,
  };
}
