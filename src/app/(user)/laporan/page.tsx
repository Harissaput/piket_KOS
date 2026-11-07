'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { useMembers } from '@/hooks/useMembers';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ScheduleEpoch, ScheduleOverride, CompletionLog } from '@/types/database';
import {
  computeCollectiveReportSummary,
  generateReportsCsv,
  MemberPerformanceStats,
} from '@/lib/reports/stats';
import { formatLocalDate } from '@/lib/utils/date';
import { subDays, subMonths, startOfWeek, endOfWeek, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  BarChart2,
  Download,
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  TrendingUp,
  User,
} from 'lucide-react';

type PeriodFilter = 'minggu_ini' | 'bulan_ini' | '3_bulan' | 'semua' | 'custom';

export default function LaporanPage() {
  const { members, isLoading: loadingMembers } = useMembers(true);
  const { startDate, hariLibur } = useSettings();
  const { member: loggedInMember, role } = useAuth();

  const [period, setPeriod] = useState<PeriodFilter>('bulan_ini');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [epochs, setEpochs] = useState<ScheduleEpoch[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [logs, setLogs] = useState<CompletionLog[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    setErrorMsg(null);
    try {
      const [epochsRes, overridesRes, logsRes] = await Promise.all([
        supabase.from('schedule_epochs').select('*').order('effective_from', { ascending: true }),
        supabase.from('schedule_overrides').select('*'),
        supabase.from('completion_logs').select('*'),
      ]);

      if (epochsRes.error) throw epochsRes.error;
      if (overridesRes.error) throw overridesRes.error;
      if (logsRes.error) throw logsRes.error;

      setEpochs((epochsRes.data as ScheduleEpoch[]) || []);
      setOverrides((overridesRes.data as ScheduleOverride[]) || []);
      setLogs((logsRes.data as CompletionLog[]) || []);
    } catch (err: any) {
      console.error('Gagal memuat data laporan:', err);
      setErrorMsg(err.message || 'Gagal memuat data laporan');
    } finally {
      setIsLoadingData(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Hitung rentang tanggal berdasarkan period yang dipilih
  const { rangeStart, rangeEnd, periodLabel } = useMemo(() => {
    const today = new Date();
    const todayStr = formatLocalDate(today);
    const systemStart = startDate || '2026-08-31';

    if (period === 'minggu_ini') {
      const mon = startOfWeek(today, { weekStartsOn: 1 });
      const sun = endOfWeek(today, { weekStartsOn: 1 });
      return {
        rangeStart: formatLocalDate(mon),
        rangeEnd: formatLocalDate(sun),
        periodLabel: 'Minggu Ini',
      };
    }

    if (period === 'bulan_ini') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const start = `${year}-${month}-01`;
      return {
        rangeStart: start,
        rangeEnd: todayStr,
        periodLabel: format(today, 'MMMM yyyy', { locale: localeId }),
      };
    }

    if (period === '3_bulan') {
      const threeMonthsAgo = subMonths(today, 3);
      return {
        rangeStart: formatLocalDate(threeMonthsAgo),
        rangeEnd: todayStr,
        periodLabel: '3 Bulan Terakhir',
      };
    }

    if (period === 'custom') {
      return {
        rangeStart: customStart || systemStart,
        rangeEnd: customEnd || todayStr,
        periodLabel: `${customStart || systemStart} s.d. ${customEnd || todayStr}`,
      };
    }

    // Default 'semua'
    return {
      rangeStart: systemStart,
      rangeEnd: todayStr,
      periodLabel: 'Semua Periode',
    };
  }, [period, customStart, customEnd, startDate]);

  // Hitung metrik laporan menggunakan modul bersama
  const reportSummary = useMemo(() => {
    if (members.length === 0 || !rangeStart || !rangeEnd) return null;

    return computeCollectiveReportSummary(
      rangeStart,
      rangeEnd,
      members,
      epochs,
      overrides,
      logs,
      hariLibur
    );
  }, [rangeStart, rangeEnd, members, epochs, overrides, logs, hariLibur]);

  // Download CSV
  const handleDownloadCsv = () => {
    if (!reportSummary) return;
    const csvData = generateReportsCsv(reportSummary, periodLabel);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Piket_Kos_${period}_${rangeStart}_sd_${rangeEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading = loadingMembers || isLoadingData;

  // Temukan statistik user yang login
  const myStats = useMemo(() => {
    if (!reportSummary || !loggedInMember) return null;
    return reportSummary.memberStats.find((m) => m.memberId === loggedInMember.id) || null;
  }, [reportSummary, loggedInMember]);

  return (
    <div className="space-y-6">
      <TopBar title="Laporan & Kedisiplinan Piket" />

      {/* Toolbar Filter & Export */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 mr-1">
            Periode:
          </span>
          {(['minggu_ini', 'bulan_ini', '3_bulan', 'semua', 'custom'] as PeriodFilter[]).map((p) => {
            const labels: Record<PeriodFilter, string> = {
              minggu_ini: 'Minggu Ini',
              bulan_ini: 'Bulan Ini',
              '3_bulan': '3 Bulan',
              semua: 'Semua Waktu',
              custom: 'Kustom',
            };
            const isSelected = period === p;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-[#141416] text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleDownloadCsv}
          disabled={!reportSummary || reportSummary.memberStats.length === 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-sm disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Ekspor CSV (Excel)</span>
        </button>
      </div>

      {/* Custom Date Inputs if selected */}
      {period === 'custom' && (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 flex-wrap text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Mulai:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Sampai:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Definition note */}
      <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-2xl flex items-center gap-2.5 text-xs text-purple-900">
        <HelpCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
        <span>
          <strong>Definisi Kedisiplinan:</strong> Selesai / (Selesai + Terlewat) * 100. Status Izin dan Ditukar tidak dihitung sebagai beban kedisiplinan.
        </span>
      </div>

      {/* Main KPI Cards */}
      {reportSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold">Total Jadwal Piket</p>
              <p className="text-2xl font-black text-gray-900">{reportSummary.totalPiket}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{periodLabel}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold">Rata-rata Kedisiplinan</p>
              <p className="text-2xl font-black text-gray-900">
                {reportSummary.avgDisciplineRate !== null ? `${reportSummary.avgDisciplineRate}%` : '-'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Semua Anggota</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold">Anggota Paling Rajin</p>
              <p className="text-lg font-black text-gray-900 truncate max-w-[140px]">
                {reportSummary.bestMember ? reportSummary.bestMember.name : '-'}
              </p>
              <p className="text-[10px] text-amber-600 font-bold mt-0.5">
                {reportSummary.bestMember?.disciplineRate !== null
                  ? `${reportSummary.bestMember?.disciplineRate}% (${reportSummary.bestMember?.totalSelesai} selesai)`
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sorotan Khusus Akun Login (Jika Bukan Admin) */}
      {myStats && (
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-3xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/30 flex items-center justify-center text-xl font-bold bg-white/10"
              style={{ backgroundColor: myStats.avatarColor }}
            >
              {myStats.avatarUrl ? (
                <img src={myStats.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                myStats.name.charAt(0)
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                Sorotan Performa Anda
              </span>
              <h3 className="text-xl font-extrabold text-white">{myStats.name}</h3>
              <p className="text-xs text-purple-200">
                Streak Selesai Berturut-turut: <strong>{myStats.streak} kali</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-center">
            <div className="bg-white/10 px-4 py-2 rounded-2xl">
              <p className="text-[10px] text-purple-200 uppercase font-bold">Kedisiplinan</p>
              <p className="text-xl font-black text-emerald-400">
                {myStats.disciplineRate !== null ? `${myStats.disciplineRate}%` : '-'}
              </p>
            </div>
            <div className="bg-white/10 px-4 py-2 rounded-2xl">
              <p className="text-[10px] text-purple-200 uppercase font-bold">Selesai</p>
              <p className="text-xl font-black text-white">{myStats.totalSelesai}</p>
            </div>
            <div className="bg-white/10 px-4 py-2 rounded-2xl">
              <p className="text-[10px] text-purple-200 uppercase font-bold">Terlewat</p>
              <p className="text-xl font-black text-rose-300">{myStats.totalTerlewat}</p>
            </div>
          </div>
        </div>
      )}

      {/* Member Cards Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-xs font-bold text-gray-400 bg-white rounded-3xl border border-gray-100">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
          Memproses komputasi laporan dan performa...
        </div>
      ) : errorMsg ? (
        <div className="p-12 text-center text-xs font-bold text-rose-600 bg-white rounded-3xl border border-gray-100">
          {errorMsg}
        </div>
      ) : !reportSummary || reportSummary.memberStats.length === 0 ? (
        <div className="p-16 text-center text-xs font-bold text-gray-400 bg-white rounded-3xl border border-gray-100">
          Tidak ada data anggota atau jadwal untuk periode ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reportSummary.memberStats.map((stats) => {
            const isMe = loggedInMember?.id === stats.memberId;
            return (
              <div
                key={stats.memberId}
                className={`bg-white rounded-3xl p-6 shadow-sm border transition-all space-y-4 ${
                  isMe ? 'ring-2 ring-purple-600 border-purple-200' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-12 h-12 rounded-full overflow-hidden border-2 shadow-sm flex items-center justify-center font-bold text-white text-base"
                      style={{ backgroundColor: stats.avatarColor }}
                    >
                      {stats.avatarUrl ? (
                        <img src={stats.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        stats.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-gray-900 text-base">{stats.name}</h4>
                        {isMe && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            Saya
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 font-semibold">
                        {stats.statusAktif ? 'Anggota Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-black text-gray-900 block">
                      {stats.disciplineRate !== null ? `${stats.disciplineRate}%` : '-'}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Disiplin
                    </span>
                  </div>
                </div>

                {/* Progress Bar Kedisiplinan */}
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${stats.disciplineRate ?? 0}%`,
                      backgroundColor:
                        (stats.disciplineRate ?? 0) >= 80
                          ? '#10b981'
                          : (stats.disciplineRate ?? 0) >= 50
                          ? '#f59e0b'
                          : '#ef4444',
                    }}
                  />
                </div>

                {/* Breakdown Mini Grid */}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-100 text-center">
                  <div className="p-2 bg-gray-50 rounded-2xl">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Jadwal</p>
                    <p className="text-xs font-black text-gray-900 mt-0.5">{stats.totalJadwal}</p>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-2xl">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Selesai</p>
                    <p className="text-xs font-black text-emerald-800 mt-0.5">{stats.totalSelesai}</p>
                  </div>
                  <div className="p-2 bg-rose-50 rounded-2xl">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-rose-700">Terlewat</p>
                    <p className="text-xs font-black text-rose-800 mt-0.5">{stats.totalTerlewat}</p>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-2xl">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-blue-700">Tukar</p>
                    <p className="text-xs font-black text-blue-800 mt-0.5">{stats.totalDitukar}</p>
                  </div>
                </div>

                {/* Streak footer */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <span>Streak Selesai:</span>
                  <span className="font-bold text-gray-900">{stats.streak}x berturut-turut</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
