'use client';

import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Member, DaySchedule as DbDaySchedule } from '@/types/database';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface WeeklyScheduleWidgetProps {
  members?: Member[];
  weeklySchedule?: DbDaySchedule[];
  currentWeekDate?: Date;
  goToPrevWeek?: () => void;
  goToNextWeek?: () => void;
}

export default function WeeklyScheduleWidget({ 
  members = [],
  weeklySchedule = [],
  currentWeekDate = new Date(),
  goToPrevWeek,
  goToNextWeek
}: WeeklyScheduleWidgetProps) {
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekLabel = weeklySchedule.length > 0 
    ? `${format(weeklySchedule[0].date, 'd')}–${format(weeklySchedule[6].date, 'd MMM yyyy', { locale: idLocale })}`
    : format(new Date(), 'd MMM yyyy', { locale: idLocale });

  const displayDays = weeklySchedule.length > 0
    ? weeklySchedule.map(day => ({
        shortDayName: day.shortDayName,
        dayName: day.dayName,
        isLibur: day.isLibur,
        isToday: day.dateFormatted === todayStr,
        memberTop: day.member,
      }))
    : [];

  return (
    <div className="bg-[#1e1f23] text-white rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between overflow-hidden">
      {/* Widget Top Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-xl font-bold text-white">Jadwal Mingguan</h3>
        <button className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2a2c31] text-xs font-semibold text-gray-300 hover:bg-[#34373d] transition-colors">
          <span>{weekLabel}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sub Header Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs sm:text-sm font-semibold text-white">Minggu Berjalan</h4>
          <p className="text-[11px] sm:text-xs text-gray-400">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={goToPrevWeek} className="p-1.5 sm:p-2 rounded-full bg-[#2a2c31] hover:bg-[#34373d] text-gray-300 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button onClick={goToNextWeek} className="p-1.5 sm:p-2 rounded-full bg-[#2a2c31] hover:bg-[#34373d] text-gray-300 transition-colors">
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Days Grid - Scrollable on very small screens, exact 7-column layout */}
      <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 min-w-[500px] sm:min-w-0 items-stretch">
          {displayDays.map((day, idx) => (
            <div
              key={idx}
              className={`flex flex-col items-center py-2.5 sm:py-3 px-1 rounded-2xl transition-all h-[130px] sm:h-[140px] ${
                day.isToday
                  ? 'bg-[#2a2d33] ring-1 ring-lime-400/80 shadow-lg'
                  : 'bg-[#25272c]'
              }`}
            >
              {/* Day Title */}
              <span
                className={`text-[11px] sm:text-xs font-semibold mb-2 sm:mb-3 ${
                  day.isToday ? 'text-lime-300' : 'text-gray-400'
                }`}
              >
                {day.shortDayName}
              </span>

              {day.isLibur ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <span className="text-[11px] sm:text-xs font-semibold text-gray-400 tracking-wider">
                    Libur
                  </span>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3 w-full flex flex-col items-center flex-1 justify-center">
                  {/* Top Slot */}
                  {day.memberTop && (
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-gray-600 mb-1">
                        {day.memberTop.avatar_url ? (
                          <img
                            src={day.memberTop.avatar_url}
                            alt={day.memberTop.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-purple-600 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center">
                            {day.memberTop.name[0]}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] sm:text-xs font-medium text-gray-300">
                        {day.memberTop.name}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
