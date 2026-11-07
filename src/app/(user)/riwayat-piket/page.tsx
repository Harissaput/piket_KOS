'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { useMembers } from '@/hooks/useMembers';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/context/AuthContext';
import { useSearch } from '@/context/SearchContext';
import { createClient } from '@/lib/supabase/client';
import { ScheduleEpoch, ScheduleOverride, CompletionLog } from '@/types/database';
import {
  computeEffectiveDutyRecords,
  DailyDutyRecord,
} from '@/lib/reports/stats';
import { formatLocalDate } from '@/lib/utils/date';
import { parseISO, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  Clock,
  Filter,
  Check,
  AlertCircle,
  RefreshCw,
  Edit3,
  X,
  Calendar,
} from 'lucide-react';

export default function RiwayatPiketPage() {
  const { members, isLoading: loadingMembers } = useMembers(true);
  const { startDate, hariLibur } = useSettings();
  const { member: loggedInMember, role } = useAuth();
  const { searchQuery } = useSearch();

  const [epochs, setEpochs] = useState<ScheduleEpoch[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [logs, setLogs] = useState<CompletionLog[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [filterMember, setFilterMember] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState<'Semua' | 'selesai' | 'terlewat' | 'izin' | 'ditukar' | 'belum'>('Semua');
  const [filterMonth, setFilterMonth] = useState('Semua'); // 'YYYY-MM'

  // Pagination / Load More
  const [displayLimit, setDisplayLimit] = useState(25);

  // Admin Correct Log Modal
  const [correctingRecord, setCorrectingRecord] = useState<DailyDutyRecord | null>(null);
  const [correctStatus, setCorrectStatus] = useState<'selesai' | 'terlewat' | 'izin' | 'ditukar'>('selesai');
  const [correctNote, setCorrectNote] = useState('');
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    setErrorMsg(null);
    try {
      const todayStr = formatLocalDate(new Date());
      const effectiveStart = startDate || '2026-08-31';

      const [epochsRes, overridesRes, logsRes] = await Promise.all([
        supabase.from('schedule_epochs').select('*').order('effective_from', { ascending: true }),
        supabase.from('schedule_overrides').select('*, original_member:members!original_member_id(*), new_member:members!new_member_id(*)'),
        supabase.from('completion_logs').select('*, member:members(*)').order('date', { ascending: false }),
      ]);

      if (epochsRes.error) throw epochsRes.error;
      if (overridesRes.error) throw overridesRes.error;
      if (logsRes.error) throw logsRes.error;

      setEpochs((epochsRes.data as ScheduleEpoch[]) || []);
      setOverrides((overridesRes.data as ScheduleOverride[]) || []);
      setLogs((logsRes.data as CompletionLog[]) || []);
    } catch (err: any) {
      console.error('Gagal memuat riwayat:', err);
      setErrorMsg(err.message || 'Gagal memuat data riwayat.');
    } finally {
      setIsLoadingData(false);
    }
  }, [startDate, supabase]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`riwayat-realtime-${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completion_logs' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_overrides' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase]);

  // Hitung riwayat harian utuh (hari tanpa log masa lalu otomatis berstatus terlewat)
  const allDailyRecords = useMemo(() => {
    if (members.length === 0) return [];
    const effectiveStart = startDate || '2026-08-31';
    const todayStr = formatLocalDate(new Date());

    const records = computeEffectiveDutyRecords(
      effectiveStart,
      todayStr,
      members,
      epochs,
      overrides,
      logs,
      hariLibur
    );

    // Filter keluar hari libur (Minggu) agar riwayat hanya berfokus pada hari tugas
    // Dan urutkan dari tanggal terbaru ke terlama
    return records.filter((r) => !r.isHoliday).reverse();
  }, [members, startDate, epochs, overrides, logs, hariLibur]);

  // Daftar bulan yang tersedia untuk filter
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    allDailyRecords.forEach((r) => {
      monthSet.add(r.date.substring(0, 7)); // YYYY-MM
    });
    return Array.from(monthSet).sort().reverse();
  }, [allDailyRecords]);

  // Filter gabungan
  const filteredRecords = useMemo(() => {
    return allDailyRecords.filter((record) => {
      const memberName = record.dutyMember?.name || 'Tanpa Petugas';
      const matchesMember = filterMember === 'Semua' || memberName === filterMember;
      const matchesStatus = filterStatus === 'Semua' || record.effectiveStatus === filterStatus;
      const matchesMonth = filterMonth === 'Semua' || record.date.startsWith(filterMonth);

      const matchesSearch =
        !searchQuery ||
        memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.date.includes(searchQuery) ||
        record.effectiveStatus.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (record.log?.note && record.log.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (record.override?.reason && record.override.reason.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesMember && matchesStatus && matchesMonth && matchesSearch;
    });
  }, [allDailyRecords, filterMember, filterStatus, filterMonth, searchQuery]);

  const visibleRecords = filteredRecords.slice(0, displayLimit);

  // Rekap ringkas
  const countSelesai = filteredRecords.filter((r) => r.effectiveStatus === 'selesai').length;
  const countTerlewat = filteredRecords.filter((r) => r.effectiveStatus === 'terlewat').length;
  const countDitukar = filteredRecords.filter((r) => r.effectiveStatus === 'ditukar').length;
  const countIzin = filteredRecords.filter((r) => r.effectiveStatus === 'izin').length;

  const handleOpenCorrection = (record: DailyDutyRecord) => {
    setCorrectingRecord(record);
    const initialStatus =
      record.effectiveStatus === 'belum' ? 'selesai' : (record.effectiveStatus as any);
    setCorrectStatus(initialStatus);
    setCorrectNote(record.log?.note || '');
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord) return;

    const targetMemberId = correctingRecord.dutyMember?.id || correctingRecord.scheduledMember?.id;
    if (!targetMemberId) {
      setFeedback({ type: 'error', text: 'Tidak ada anggota yang terkait dengan tanggal ini.' });
      return;
    }

    setIsSavingCorrection(true);
    try {
      const { error } = await supabase.from('completion_logs').upsert(
        {
          date: correctingRecord.date,
          member_id: targetMemberId,
          status: correctStatus,
          note: correctNote.trim() ? `[Koreksi Admin] ${correctNote.trim()}` : '[Koreksi Admin]',
          completed_at: correctStatus === 'selesai' ? new Date().toISOString() : null,
        },
        { onConflict: 'date,member_id' }
      );

      if (error) throw error;

      setFeedback({ type: 'success', text: `Riwayat piket tanggal ${correctingRecord.date} berhasil diperbarui.` });
      setCorrectingRecord(null);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: err.message || 'Gagal menyimpan koreksi riwayat.' });
    } finally {
      setIsSavingCorrection(false);
    }
  };

  const isLoading = loadingMembers || isLoadingData;

  return (
    <div className="space-y-6">
      <TopBar title="Riwayat Piket Kost" />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold">Selesai</p>
            <p className="text-xl font-black text-gray-900">{countSelesai}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold">Terlewat</p>
            <p className="text-xl font-black text-gray-900">{countTerlewat}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold">Ditukar</p>
            <p className="text-xl font-black text-gray-900">{countDitukar}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold">Izin</p>
            <p className="text-xl font-black text-gray-900">{countIzin}</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">Filter Riwayat</h3>
          </div>

          <button
            onClick={() => fetchData()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Muat Ulang</span>
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter Anggota */}
          <select
            value={filterMember}
            onChange={(e) => setFilterMember(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:bg-white"
          >
            <option value="Semua">Semua Anggota</option>
            {members.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name} {!m.status_aktif && '(Nonaktif)'}
              </option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:bg-white"
          >
            <option value="Semua">Semua Status</option>
            <option value="selesai">Selesai</option>
            <option value="terlewat">Terlewat</option>
            <option value="ditukar">Ditukar</option>
            <option value="izin">Izin</option>
            <option value="belum">Belum</option>
          </select>

          {/* Filter Bulan */}
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:bg-white"
          >
            <option value="Semua">Semua Bulan</option>
            {availableMonths.map((mStr) => {
              const d = parseISO(`${mStr}-01`);
              const label = format(d, 'MMMM yyyy', { locale: localeId });
              return (
                <option key={mStr} value={mStr}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-start gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Table / List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-xs font-bold text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
            Menghitung riwayat jadwal dan status piket...
          </div>
        ) : errorMsg ? (
          <div className="p-12 text-center text-xs font-bold text-rose-600 space-y-3">
            <p>{errorMsg}</p>
            <button
              onClick={() => fetchData()}
              className="px-4 py-2 bg-rose-50 text-rose-700 rounded-full font-bold hover:bg-rose-100"
            >
              Coba Lagi
            </button>
          </div>
        ) : visibleRecords.length === 0 ? (
          <div className="p-16 text-center text-xs font-bold text-gray-400">
            Tidak ada data riwayat piket yang cocok dengan filter yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-6">Tanggal</th>
                  <th className="py-4 px-6">Petugas Piket</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Tugas Selesai / Catatan</th>
                  {role === 'admin' && <th className="py-4 px-6 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleRecords.map((r, idx) => {
                  const dateObj = parseISO(r.date);
                  const dateHuman = format(dateObj, 'EEEE, d MMMM yyyy', { locale: localeId });
                  const isOverridden = Boolean(r.override);
                  const dutyMemberName = r.dutyMember?.name || 'Tanpa Petugas';
                  const scheduledMemberName = r.scheduledMember?.name;

                  return (
                    <tr key={`${r.date}_${idx}`} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-900 whitespace-nowrap">
                        {dateHuman}
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                            style={{ backgroundColor: r.dutyMember?.avatar_color || '#a855f7' }}
                          >
                            {r.dutyMember?.avatar_url ? (
                              <img src={r.dutyMember.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              dutyMemberName.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{dutyMemberName}</p>
                            {isOverridden && scheduledMemberName && scheduledMemberName !== dutyMemberName && (
                              <p className="text-[10px] text-purple-600 font-semibold">
                                Menggantikan: {scheduledMemberName} ({r.override?.reason})
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            r.effectiveStatus === 'selesai'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.effectiveStatus === 'terlewat'
                              ? 'bg-rose-100 text-rose-800'
                              : r.effectiveStatus === 'ditukar'
                              ? 'bg-blue-100 text-blue-800'
                              : r.effectiveStatus === 'izin'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {r.effectiveStatus}
                        </span>
                      </td>

                      <td className="py-4 px-6 max-w-xs truncate text-gray-600">
                        {r.log?.completed_tasks && r.log.completed_tasks.length > 0 ? (
                          <span className="font-semibold text-gray-800">
                            {r.log.completed_tasks.length} tugas selesai
                          </span>
                        ) : null}
                        {r.log?.note && (
                          <span className="block text-[11px] text-gray-500 italic truncate">
                            {r.log.note}
                          </span>
                        )}
                        {!r.log && r.effectiveStatus === 'terlewat' && (
                          <span className="text-[11px] text-rose-600 italic">
                            Tidak ada konfirmasi piket
                          </span>
                        )}
                      </td>

                      {role === 'admin' && (
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenCorrection(r)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-full transition-all"
                            title="Koreksi Catatan Piket"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Koreksi</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More Button */}
        {filteredRecords.length > visibleRecords.length && (
          <div className="p-4 text-center border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={() => setDisplayLimit((prev) => prev + 25)}
              className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-full hover:bg-gray-100 transition-all shadow-xs"
            >
              Muat Lebih Banyak ({filteredRecords.length - visibleRecords.length} tersisa)
            </button>
          </div>
        )}
      </div>

      {/* MODAL KOREKSI RIWAYAT OLEH ADMIN */}
      {correctingRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Koreksi Status Piket</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tanggal: {format(parseISO(correctingRecord.date), 'EEEE, d MMMM yyyy', { locale: localeId })}
                </p>
              </div>
              <button
                onClick={() => setCorrectingRecord(null)}
                className="p-1.5 text-gray-400 hover:text-gray-900 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Petugas
                </label>
                <div className="p-3 bg-gray-50 rounded-2xl text-xs font-bold text-gray-900">
                  {correctingRecord.dutyMember?.name || correctingRecord.scheduledMember?.name || '-'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Pilih Status Baru
                </label>
                <select
                  value={correctStatus}
                  onChange={(e) => setCorrectStatus(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:bg-white"
                >
                  <option value="selesai">Selesai</option>
                  <option value="terlewat">Terlewat</option>
                  <option value="izin">Izin</option>
                  <option value="ditukar">Ditukar</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Catatan Koreksi Admin
                </label>
                <textarea
                  rows={3}
                  value={correctNote}
                  onChange={(e) => setCorrectNote(e.target.value)}
                  placeholder="Contoh: Sudah konfirmasi via WA karena lupa klik di web"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium text-gray-900 focus:outline-none focus:bg-white focus:border-black"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-full transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingCorrection}
                  className="px-5 py-2 text-xs font-bold rounded-full bg-[#141416] hover:bg-black text-white transition-all shadow-md disabled:opacity-50"
                >
                  {isSavingCorrection ? 'Menyimpan...' : 'Simpan Koreksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
