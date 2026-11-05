'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { useMembers } from '@/hooks/useMembers';
import { useSettings } from '@/hooks/useSettings';
import { useSchedule } from '@/hooks/useSchedule';
import { useCompletionLogs } from '@/hooks/useCompletionLogs';
import { formatLocalDate } from '@/lib/utils/date';
import {
  Users,
  Clock,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  ChevronRight,
  Shield,
  Activity,
} from 'lucide-react';
import { Profile, SwapRequest, CompletionLog } from '@/types/database';

export default function AdminDashboardPage() {
  const { members } = useMembers();
  const { startDate } = useSettings();
  const { todayMember } = useSchedule(members, startDate);
  const { logs } = useCompletionLogs();

  const [pendingAccountsCount, setPendingAccountsCount] = useState(0);
  const [pendingSwapsCount, setPendingSwapsCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState<
    { id: string; title: string; time: string; type: 'log' | 'swap' | 'user' }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();
  const todayStr = formatLocalDate(new Date());

  const fetchAdminStats = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Pending profiles count
      const { count: pendingProfiles } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingAccountsCount(pendingProfiles || 0);

      // 2. Pending swap requests count
      const { count: pendingSwaps } = await supabase
        .from('swap_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingSwapsCount(pendingSwaps || 0);

      // 3. 5 Aktivitas terbaru
      const [recentLogsRes, recentSwapsRes, recentUsersRes] = await Promise.all([
        supabase
          .from('completion_logs')
          .select('id, date, status, member:members(name), created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('swap_requests')
          .select('id, date_requester, status, requester:members!requester_id(name), target_member:members!target_member_id(name), created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('profiles')
          .select('id, full_name, created_at, status')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const activities: { id: string; title: string; time: string; type: 'log' | 'swap' | 'user'; rawDate: Date }[] = [];

      recentLogsRes.data?.forEach((l: any) => {
        activities.push({
          id: `log-${l.id}`,
          title: `${l.member?.name || 'Anggota'} memperbarui piket (${l.status})`,
          time: new Date(l.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          type: 'log',
          rawDate: new Date(l.created_at),
        });
      });

      recentSwapsRes.data?.forEach((s: any) => {
        activities.push({
          id: `swap-${s.id}`,
          title: `Tukar jadwal: ${s.requester?.name || 'Anggota'} → ${s.target_member?.name || 'Anggota'} (${s.status})`,
          time: new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          type: 'swap',
          rawDate: new Date(s.created_at),
        });
      });

      recentUsersRes.data?.forEach((u: any) => {
        activities.push({
          id: `user-${u.id}`,
          title: `Pendaftaran akun baru: ${u.full_name} (${u.status})`,
          time: new Date(u.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          type: 'user',
          rawDate: new Date(u.created_at),
        });
      });

      activities.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
      setRecentActivities(activities.slice(0, 5));
    } catch (err) {
      console.warn('Error fetching admin dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAdminStats();

    // Subscribe to realtime updates on profiles & swap_requests
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAdminStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests' }, () => fetchAdminStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completion_logs' }, () => fetchAdminStats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAdminStats, supabase]);

  // Today duty status
  const todayLog = logs.find((l) => l.date === todayStr);

  return (
    <div className="space-y-6">
      <TopBar title="Dashboard Admin" />

      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Piket Hari Ini */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Piket Hari Ini
            </span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 truncate">
              {todayMember ? todayMember.name : 'Hari Libur'}
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Status:{' '}
              <span
                className={`font-bold ${
                  todayLog?.status === 'selesai'
                    ? 'text-emerald-600'
                    : todayLog?.status === 'terlewat'
                    ? 'text-rose-600'
                    : 'text-amber-600'
                }`}
              >
                {todayLog?.status === 'selesai'
                  ? 'Selesai'
                  : todayLog?.status === 'terlewat'
                  ? 'Terlewat'
                  : 'Belum Dikerjakan'}
              </span>
            </p>
          </div>
        </div>

        {/* Card 2: Akun Pending */}
        <Link
          href="/admin/pengguna"
          className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Akun Pending
            </span>
            <div className={`p-2.5 rounded-2xl ${pendingAccountsCount > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-black text-gray-900">
                {pendingAccountsCount}
              </h3>
              <span className="text-xs font-bold text-purple-600 group-hover:translate-x-1 transition-transform flex items-center">
                Kelola <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Menunggu persetujuan admin
            </p>
          </div>
        </Link>

        {/* Card 3: Permintaan Tukar Pending */}
        <Link
          href="/admin/jadwal"
          className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Tukar Jadwal
            </span>
            <div className={`p-2.5 rounded-2xl ${pendingSwapsCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
              <ArrowLeftRight className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-black text-gray-900">
                {pendingSwapsCount}
              </h3>
              <span className="text-xs font-bold text-purple-600 group-hover:translate-x-1 transition-transform flex items-center">
                Lihat <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Permintaan menunggu konfirmasi
            </p>
          </div>
        </Link>

        {/* Card 4: Total Anggota Kost */}
        <Link
          href="/admin/anggota"
          className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Anggota Aktif
            </span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-black text-gray-900">
                {members.filter((m) => m.status_aktif).length}
              </h3>
              <span className="text-xs font-bold text-purple-600 group-hover:translate-x-1 transition-transform flex items-center">
                Atur <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Dari {members.length} slot terdaftar
            </p>
          </div>
        </Link>
      </div>

      {/* Middle Section: Discipline & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Discipline Rate per Member */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Persentase Kedisiplinan</h3>
                <p className="text-xs text-gray-500 font-medium">Berdasarkan data piket selesai vs terlewat</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {members.map((member) => {
              const memberLogs = logs.filter((l) => l.member_id === member.id);
              const totalSelesai = memberLogs.filter((l) => l.status === 'selesai').length;
              const total = memberLogs.length;
              const rate = total > 0 ? Math.round((totalSelesai / total) * 100) : 100;

              return (
                <div key={member.id} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-200 bg-white">
                        <img
                          src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-900">{member.name}</span>
                        <span className="text-[11px] text-gray-500 block">
                          {totalSelesai} selesai dari {total} jadwal
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                      {rate}%
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5 Recent Activities */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">5 Aktivitas Terbaru</h3>
                <p className="text-xs text-gray-500 font-medium">Log piket, pendaftaran & tukar jadwal</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {recentActivities.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 font-medium">
                Belum ada aktivitas terbaru.
              </div>
            ) : (
              recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-2xl bg-gray-50 border border-gray-100/80 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                    <p className="text-xs font-semibold text-gray-800 leading-snug truncate">
                      {act.title}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                    {act.time}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
