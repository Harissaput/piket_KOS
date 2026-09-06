'use client';

import React from 'react';
import TopBar from '@/components/layout/TopBar';
import { useMembers } from '@/hooks/useMembers';
import { useSchedule } from '@/hooks/useSchedule';
import { INITIAL_MEMBERS } from '@/lib/constants/members';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function JadwalMingguanPage() {
  const { members } = useMembers();
  const activeMembers = members.length > 0 ? members : INITIAL_MEMBERS;

  const {
    weeklySchedule,
    goToPrevWeek,
    goToNextWeek,
  } = useSchedule(activeMembers, '2026-08-31');

  return (
    <div className="space-y-6">
      <TopBar title="Jadwal Mingguan Piket" />

      {/* Week Selector */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Siklus Mingguan
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Rotasi adil 3-mingguan (Haris, Fahrul, Ishom)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-full border border-gray-200">
          <button
            onClick={goToPrevWeek}
            className="p-2 rounded-full hover:bg-white hover:shadow-sm text-gray-700 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-gray-800 px-4">
            {weeklySchedule.length > 0 && (
              <>
                {format(weeklySchedule[0].date, 'd MMM', { locale: id })} -{' '}
                {format(weeklySchedule[6].date, 'd MMM yyyy', { locale: id })}
              </>
            )}
          </span>
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-full hover:bg-white hover:shadow-sm text-gray-700 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 7-Day Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weeklySchedule.map((day, idx) => (
          <div
            key={idx}
            className={`bg-white rounded-3xl p-5 shadow-sm border flex flex-col justify-between min-h-[220px] transition-all hover:shadow-md ${
              day.isLibur
                ? 'border-dashed border-gray-300 bg-gray-50/50'
                : 'border-gray-100'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {day.dayName}
                </span>
                <span className="text-sm font-extrabold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">
                  {day.dayNumber}
                </span>
              </div>

              {day.isLibur ? (
                <div className="my-8 text-center">
                  <span className="inline-block px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
                    🎉 Hari Libur
                  </span>
                  <p className="text-[11px] text-gray-400 mt-2">Bebas piket</p>
                </div>
              ) : (
                day.member && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 rounded-2xl bg-gray-50">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 shadow-sm flex-shrink-0 bg-purple-50">
                        <img
                          src={day.member.avatar_url}
                          alt={day.member.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{day.member.name}</p>
                        <p className="text-[10px] text-gray-500 font-medium">
                          {day.override ? `Ditukar (${day.override.reason})` : 'Petugas Utama'}
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 bg-purple-50/60 p-2.5 rounded-xl border border-purple-100">
                      <span className="font-semibold text-purple-900">Tugas:</span>
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-purple-800">
                        <li>Sapu & Pel</li>
                        <li>Buang Sampah</li>
                      </ul>
                    </div>
                  </div>
                )
              )}
            </div>

            {!day.isLibur && (
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Scheduled
                </span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
