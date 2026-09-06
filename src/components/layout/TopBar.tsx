'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Search, Bell, ChevronDown, WifiOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearch } from '@/context/SearchContext';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

import { useMembers } from '@/hooks/useMembers';
import { useSchedule } from '@/hooks/useSchedule';
import { useCompletionLogs } from '@/hooks/useCompletionLogs';
import { INITIAL_MEMBERS } from '@/lib/constants/members';

interface TopBarProps {
  title?: string;
}

export default function TopBar({ title = 'Ringkasan Piket Kost' }: TopBarProps) {
  const { searchQuery, setSearchQuery } = useSearch();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  
  const { members } = useMembers();
  const activeMembers = members.length > 0 ? members : INITIAL_MEMBERS;
  const { todayMember } = useSchedule(activeMembers, '2026-08-31');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { logs } = useCompletionLogs({ startDate: todayStr, endDate: todayStr });
  
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

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

  // Compute notifications based on today's duty and status
  useEffect(() => {
    const notifs: string[] = [];
    const isHoliday = new Date().getDay() === 0;

    if (isHoliday) {
      notifs.push('Hari ini libur piket.');
    } else if (!todayMember) {
      notifs.push('Tidak ada jadwal piket hari ini.');
    } else {
      notifs.push('Hari ini kamu mendapat jadwal piket.');
      
      const log = logs.find(l => l.member_id === todayMember.id && l.date === todayStr);
      if (log && log.status === 'selesai') {
        notifs.push('Piket hari ini sudah diselesaikan.');
      } else {
        notifs.push('Piket hari ini belum diselesaikan.');
      }
    }

    setNotifications(notifs);
  }, [todayMember, logs, todayStr]);

  // Real-time clock update every 1 second
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Supabase connection check
  useEffect(() => {
    async function checkSupabaseConnection() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!url || url.includes('your-project-ref') || url.includes('placeholder')) {
          setIsConnected(false);
          return;
        }
        const supabase = createClient();
        const { error } = await supabase.from('members').select('id').limit(1);
        setIsConnected(!error);
      } catch {
        setIsConnected(false);
      }
    }
    checkSupabaseConnection();
  }, []);

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">{title}</h1>
        {isConnected !== null && (
          <span
            className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
              isConnected
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}
            title={
              isConnected
                ? 'Terhubung ke Database Supabase Realtime'
                : 'Mode Lokal Fallback'
            }
          >
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Supabase Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-600" />
                <span>Mode Lokal</span>
              </>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
        {/* Search Bar & Button */}
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
            className="pl-9 pr-4 py-2 text-sm bg-white rounded-full border border-transparent shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10 w-full sm:w-56 text-gray-800 placeholder-gray-400"
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

        {/* Live Ticking Date & Time Display */}
        <div className="text-xs text-gray-700 font-bold bg-white px-3 py-2 rounded-full shadow-sm border border-gray-100 hidden md:flex items-center gap-1.5">
          <span>{currentTime ? format(currentTime, 'd MMMM yyyy HH:mm:ss', { locale: id }) : '...'}</span>
        </div>

        {/* Filter Dropdown */}
        <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white rounded-full shadow-sm text-gray-800 border border-gray-100 hover:bg-gray-50 transition-colors">
          <span>Hari Ini</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`relative p-2 rounded-full shadow-sm border transition-colors ${
              isNotifOpen ? 'bg-gray-100 border-gray-200 text-gray-900' : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-emerald-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-white">
                {notifications.length}
              </span>
            )}
          </button>

          {/* Dropdown Panel */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Notifikasi</h3>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {notifications.length} Baru
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                {notifications.map((notif, idx) => {
                  const isSuccess = notif.includes('sudah') || notif.includes('libur');
                  const isWarning = notif.includes('belum');
                  
                  return (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className={`mt-0.5 rounded-full p-1.5 ${isSuccess ? 'bg-emerald-100 text-emerald-600' : isWarning ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {isSuccess ? <CheckCircle2 className="w-4 h-4" /> : isWarning ? <AlertCircle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{notif}</p>
                        <p className="text-[10px] text-gray-400 mt-1">Hari ini</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
