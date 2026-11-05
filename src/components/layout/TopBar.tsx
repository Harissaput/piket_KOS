'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Search, Bell, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearch } from '@/context/SearchContext';
import { useAuth } from '@/context/AuthContext';
import { useMembers } from '@/hooks/useMembers';
import { useSettings } from '@/hooks/useSettings';
import { useSchedule } from '@/hooks/useSchedule';
import { useCompletionLogs } from '@/hooks/useCompletionLogs';
import { formatLocalDate } from '@/lib/utils/date';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface TopBarProps {
  title?: string;
}

export default function TopBar({ title = 'Ringkasan Piket Kost' }: TopBarProps) {
  const { searchQuery, setSearchQuery } = useSearch();
  const { member: loggedInMember, user, profile, signOut } = useAuth();
  const { members } = useMembers();
  const { startDate } = useSettings();
  const { todayMember } = useSchedule(members, startDate);

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const todayStr = formatLocalDate(new Date());
  const { logs } = useCompletionLogs({ startDate: todayStr, endDate: todayStr });

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute notifications personalized to the currently logged in user
  useEffect(() => {
    const notifs: string[] = [];
    const isHoliday = new Date().getDay() === 0;

    if (isHoliday) {
      notifs.push('Hari ini libur piket untuk seluruh anggota.');
    } else if (!todayMember) {
      notifs.push('Tidak ada jadwal piket hari ini.');
    } else {
      const isMyTurn = Boolean(loggedInMember && todayMember.id === loggedInMember.id);
      const log = logs.find((l) => l.member_id === todayMember.id && l.date === todayStr);

      if (isMyTurn) {
        notifs.push('Hari ini giliran kamu piket!');
        if (log && log.status === 'selesai') {
          notifs.push('Piket hari ini sudah kamu selesaikan.');
        } else {
          notifs.push('Piket hari ini belum kamu selesaikan.');
        }
      } else {
        notifs.push(`Hari ini giliran ${todayMember.name} bertugas piket.`);
        if (log && log.status === 'selesai') {
          notifs.push(`Piket hari ini sudah diselesaikan oleh ${todayMember.name}.`);
        } else {
          notifs.push(`Piket hari ini belum diselesaikan oleh ${todayMember.name}.`);
        }
      }
    }

    setNotifications(notifs);
  }, [todayMember, logs, todayStr, loggedInMember]);

  // Real-time clock update
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
        {/* Search Bar */}
        <div className="relative flex-1 sm:flex-none">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('globalSearchInput');
              if (el) el.focus();
            }}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Cari data"
          >
            <Search className="w-4 h-4" />
          </button>
          <input
            id="globalSearchInput"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari anggota, tugas, tanggal..."
            className="pl-9 pr-4 py-2 text-xs sm:text-sm bg-white rounded-full border border-transparent shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10 w-full sm:w-56 text-gray-800 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Live Clock Display */}
        <div className="text-xs text-gray-700 font-bold bg-white px-3.5 py-2 rounded-full shadow-sm border border-gray-100 hidden md:flex items-center gap-1.5">
          <span>{currentTime ? format(currentTime, 'd MMMM yyyy HH:mm:ss', { locale: id }) : '...'}</span>
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`relative p-2 rounded-full shadow-sm border transition-colors ${
              isNotifOpen
                ? 'bg-gray-100 border-gray-200 text-gray-900'
                : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'
            }`}
            title="Notifikasi"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-purple-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white">
                {notifications.length}
              </span>
            )}
          </button>

          {/* Dropdown Panel */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden z-50">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Notifikasi</h3>
                <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                  {notifications.length} Info
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                {notifications.map((notif, idx) => {
                  const isSuccess = notif.includes('sudah') || notif.includes('libur');
                  const isWarning = notif.includes('belum');

                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors text-xs"
                    >
                      <div
                        className={`mt-0.5 rounded-full p-1.5 flex-shrink-0 ${
                          isSuccess
                            ? 'bg-emerald-100 text-emerald-600'
                            : isWarning
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-purple-100 text-purple-600'
                        }`}
                      >
                        {isSuccess ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : isWarning ? (
                          <AlertCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Bell className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 leading-snug">{notif}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Hari ini</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* TopBar Logout Icon Button for Mobile / Quick Access */}
        {user && (
          <button
            onClick={() => signOut()}
            className="p-2 bg-white rounded-full border border-gray-100 shadow-sm text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors sm:hidden"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
