'use client';

import { useState, useEffect, useCallback } from 'react';
import { Member, DaySchedule, ScheduleEpoch } from '@/types/database';
import {
  getTodayDutyMember,
  getWeeklySchedule,
  getScheduleEpochs,
} from '@/services/schedule.service';
import { createClient } from '@/lib/supabase/client';
import { formatLocalDate } from '@/lib/utils/date';

interface UseScheduleReturn {
  todayMember: Member | null;
  tomorrowMember: Member | null;
  weeklySchedule: DaySchedule[];
  currentWeekDate: Date;
  epochs: ScheduleEpoch[];
  isLoading: boolean;
  error: string | null;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching today's duty member, tomorrow's, and the full week schedule.
 * Subscribes to Realtime for schedule_overrides and schedule_epochs.
 */
export function useSchedule(
  members: Member[],
  startDate: string,
  hariLibur: string = 'Minggu'
): UseScheduleReturn {
  const [todayMember, setTodayMember] = useState<Member | null>(null);
  const [tomorrowMember, setTomorrowMember] = useState<Member | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>([]);
  const [epochs, setEpochs] = useState<ScheduleEpoch[]>([]);
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    if (members.length === 0 || !startDate) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      const [loadedEpochs] = await Promise.all([
        getScheduleEpochs(),
      ]);

      setEpochs(loadedEpochs);

      const [todayDuty, weekly] = await Promise.all([
        getTodayDutyMember(members, startDate, loadedEpochs, hariLibur),
        getWeeklySchedule(currentWeekDate, members, startDate, loadedEpochs, hariLibur),
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
  }, [members, startDate, currentWeekDate, hariLibur]);

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_epochs' },
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
    epochs,
    isLoading,
    error,
    goToPrevWeek,
    goToNextWeek,
    refetch: fetchSchedule,
  };
}
