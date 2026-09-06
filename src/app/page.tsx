'use client';

import React from 'react';
import TopBar from '@/components/layout/TopBar';
import TodayDutyCard from '@/components/dashboard/TodayDutyCard';
import TomorrowDutyCard from '@/components/dashboard/TomorrowDutyCard';
import RulesCard from '@/components/dashboard/RulesCard';
import WeeklyScheduleWidget from '@/components/dashboard/WeeklyScheduleWidget';
import { useMembers } from '@/hooks/useMembers';
import { useSchedule } from '@/hooks/useSchedule';
import { INITIAL_MEMBERS } from '@/lib/constants/members';

export default function DashboardPage() {
  const { members } = useMembers();
  const activeMembers = members.length > 0 ? members : INITIAL_MEMBERS;

  const { todayMember, tomorrowMember, weeklySchedule, currentWeekDate, goToPrevWeek, goToNextWeek } = useSchedule(
    activeMembers,
    '2026-08-31'
  );

  return (
    <div className="space-y-6">
      <TopBar title="Ringkasan Piket Kost" />

      {/* Grid Layout matching image.png */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column - Today's Duty */}
        <div className="lg:col-span-6 xl:col-span-5 h-full">
          <TodayDutyCard member={todayMember} isHoliday={new Date().getDay() === 0} />
        </div>

        {/* Right Column - Tomorrow, Rules & Weekly Schedule */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            <TomorrowDutyCard member={tomorrowMember} />
            <RulesCard />
          </div>
          <WeeklyScheduleWidget
            members={activeMembers}
            weeklySchedule={weeklySchedule}
            currentWeekDate={currentWeekDate}
            goToPrevWeek={goToPrevWeek}
            goToNextWeek={goToNextWeek}
          />
        </div>
      </div>
    </div>
  );
}
