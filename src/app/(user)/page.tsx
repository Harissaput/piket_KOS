'use client';

import React from 'react';
import TopBar from '@/components/layout/TopBar';
import TodayDutyCard from '@/components/dashboard/TodayDutyCard';
import TomorrowDutyCard from '@/components/dashboard/TomorrowDutyCard';
import WeeklyScheduleWidget from '@/components/dashboard/WeeklyScheduleWidget';
import RulesCard from '@/components/dashboard/RulesCard';
import { useMembers } from '@/hooks/useMembers';
import { useSettings } from '@/hooks/useSettings';
import { useSchedule } from '@/hooks/useSchedule';
import { useAuth } from '@/context/AuthContext';
import { Sparkles } from 'lucide-react';

export default function UserDashboardPage() {
  const { members } = useMembers();
  const { startDate, hariLibur } = useSettings();
  const {
    todayMember,
    tomorrowMember,
    weeklySchedule,
    currentWeekDate,
    goToPrevWeek,
    goToNextWeek,
  } = useSchedule(members, startDate);

  const { member: loggedInMember, profile } = useAuth();

  const isTodayHoliday =
    hariLibur === 'Minggu' ? new Date().getDay() === 0 : false;
  const isMyTurnToday = Boolean(
    loggedInMember && todayMember && loggedInMember.id === todayMember.id
  );

  return (
    <div className="space-y-6">
      <TopBar title="Ringkasan Piket Kost" />

      {/* Personal Notification Banner if today is user's duty */}
      {isMyTurnToday && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-700 to-indigo-800 text-white shadow-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-white/20 rounded-2xl flex-shrink-0 backdrop-blur-sm">
              <Sparkles className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                Hari Ini Giliran Kamu Piket!
              </h2>
              <p className="text-xs text-purple-100 font-medium mt-0.5">
                Jangan lupa selesaikan tugas sebelum jam yang ditentukan dan centang konfirmasi di bawah.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Main Column */}
        <div className="lg:col-span-7 space-y-6">
          <TodayDutyCard
            member={todayMember}
            isHoliday={isTodayHoliday}
          />

          <WeeklyScheduleWidget
            members={members}
            weeklySchedule={weeklySchedule}
            currentWeekDate={currentWeekDate}
            goToPrevWeek={goToPrevWeek}
            goToNextWeek={goToNextWeek}
          />
        </div>

        {/* Right / Secondary Column */}
        <div className="lg:col-span-5 space-y-6">
          <TomorrowDutyCard member={tomorrowMember} />

          <RulesCard />
        </div>
      </div>
    </div>
  );
}
