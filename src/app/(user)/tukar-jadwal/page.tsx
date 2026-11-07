'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { ArrowLeftRight, Check, X, Clock, AlertCircle, Ban, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useMembers } from '@/hooks/useMembers';
import { useSettings } from '@/hooks/useSettings';
import { useSwapRequests } from '@/hooks/useSwapRequests';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { ScheduleEpoch, ScheduleOverride } from '@/types/database';
import { getDutyMemberForDateWithEpochs } from '@/lib/algorithms/scheduleRotation';
import { formatLocalDate } from '@/lib/utils/date';
import { addDays, parseISO, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function TukarJadwalPage() {
  const { member: loggedInMember, role } = useAuth();
  const { members } = useMembers();
  const { startDate, hariLibur } = useSettings();

  const {
    allRequests,
    handleCreateRequest,
    handleApprove,
    handleReject,
    handleCancel,
    isLoading: loadingRequests,
    refetch,
  } = useSwapRequests();

  const [activeTab, setActiveTab] = useState<'masuk' | 'terkirim' | 'riwayat'>('masuk');

  // Form states
  const [targetMemberId, setTargetMemberId] = useState('');
  const [requesterDate, setRequesterDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Epochs & Overrides for schedule calculation
  const [epochs, setEpochs] = useState<ScheduleEpoch[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [loadingScheduleContext, setLoadingScheduleContext] = useState(true);

  const supabase = createClient();

  const fetchScheduleContext = useCallback(async () => {
    try {
      const [epochsRes, overridesRes] = await Promise.all([
        supabase.from('schedule_epochs').select('*').order('effective_from', { ascending: true }),
        supabase.from('schedule_overrides').select('*'),
      ]);
      setEpochs((epochsRes.data as ScheduleEpoch[]) || []);
      setOverrides((overridesRes.data as ScheduleOverride[]) || []);
    } catch (err) {
      console.warn('Gagal memuat konteks jadwal:', err);
    } finally {
      setLoadingScheduleContext(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchScheduleContext();
  }, [fetchScheduleContext]);

  // Anggota tujuan yang tersedia (semua anggota aktif selain diri sendiri)
  const availableTargetMembers = useMemo(() => {
    return members.filter((m) => m.status_aktif && m.id !== loggedInMember?.id);
  }, [members, loggedInMember]);

  // Set default target member
  useEffect(() => {
    if (availableTargetMembers.length > 0 && !targetMemberId) {
      setTargetMemberId(availableTargetMembers[0].id);
    }
  }, [availableTargetMembers, targetMemberId]);

  // Hitung jadwal mendatang (30 hari ke depan) untuk anggota tertentu
  const getUpcomingScheduleForMember = useCallback(
    (memberId: string) => {
      if (!memberId || members.length === 0) return [];

      const today = new Date();
      const overrideMap = new Map(overrides.map((o) => [o.date, o]));
      const effectiveStart = startDate || '2026-08-31';

      const upcoming: { dateStr: string; label: string }[] = [];

      // Telusuri 35 hari ke depan
      for (let i = 1; i <= 35; i++) {
        const d = addDays(today, i);
        if (hariLibur === 'Minggu' && d.getDay() === 0) continue;

        const dateStr = formatLocalDate(d);

        // Jika sudah ada override di tanggal ini, cek apakah new_member_id milik anggota ini
        const ov = overrideMap.get(dateStr);
        let effectiveId: string | null = null;

        if (ov) {
          effectiveId = ov.new_member_id;
        } else {
          const duty = getDutyMemberForDateWithEpochs(d, members, epochs, effectiveStart, hariLibur);
          effectiveId = duty?.id || null;
        }

        if (effectiveId === memberId) {
          const label = format(d, 'EEEE, d MMMM yyyy', { locale: localeId });
          upcoming.push({ dateStr, label });
        }
      }

      return upcoming;
    },
    [members, epochs, overrides, startDate, hariLibur]
  );

  // Pilihan tanggal mendatang pengaju
  const requesterUpcomingDates = useMemo(() => {
    if (!loggedInMember) return [];
    return getUpcomingScheduleForMember(loggedInMember.id);
  }, [loggedInMember, getUpcomingScheduleForMember]);

  // Pilihan tanggal mendatang target
  const targetUpcomingDates = useMemo(() => {
    if (!targetMemberId) return [];
    return getUpcomingScheduleForMember(targetMemberId);
  }, [targetMemberId, getUpcomingScheduleForMember]);

  // Set default dates
  useEffect(() => {
    if (requesterUpcomingDates.length > 0 && !requesterDate) {
      setRequesterDate(requesterUpcomingDates[0].dateStr);
    }
  }, [requesterUpcomingDates, requesterDate]);

  useEffect(() => {
    if (targetUpcomingDates.length > 0 && !targetDate) {
      setTargetDate(targetUpcomingDates[0].dateStr);
    }
  }, [targetUpcomingDates, targetDate]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 6000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInMember) {
      showFeedback('error', 'Akun Anda belum terhubung dengan slot anggota piket.');
      return;
    }
    if (!targetMemberId) {
      showFeedback('error', 'Silakan pilih anggota tujuan tukar.');
      return;
    }
    if (!requesterDate || !targetDate) {
      showFeedback('error', 'Silakan pilih kedua tanggal piket yang akan ditukar.');
      return;
    }
    if (requesterDate === targetDate) {
      showFeedback('error', 'Tanggal piket yang ditukar tidak boleh sama.');
      return;
    }

    setSubmitting(true);
    try {
      await handleCreateRequest({
        targetMemberId,
        dateRequester: requesterDate,
        dateTarget: targetDate,
      });

      showFeedback('success', 'Permintaan tukar jadwal berhasil diajukan dan menunggu persetujuan!');
      await fetchScheduleContext();
    } catch (err: any) {
      console.error(err);
      showFeedback('error', err.message || 'Gagal mengajukan tukar jadwal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAction = async (id: string) => {
    setProcessingId(id);
    try {
      await handleApprove(id);
      showFeedback('success', 'Permintaan tukar jadwal disetujui! Jadwal otomatis diperbarui.');
      await fetchScheduleContext();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menyetujui permintaan.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectAction = async (id: string) => {
    setProcessingId(id);
    try {
      await handleReject(id);
      showFeedback('success', 'Permintaan tukar jadwal ditolak.');
      await fetchScheduleContext();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menolak permintaan.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelAction = async (id: string) => {
    setProcessingId(id);
    try {
      await handleCancel(id);
      showFeedback('success', 'Permintaan tukar berhasil dibatalkan.');
      await fetchScheduleContext();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal membatalkan permintaan.');
    } finally {
      setProcessingId(null);
    }
  };

  // Tab filtering
  const masukRequests = useMemo(() => {
    return allRequests.filter(
      (r) => r.status === 'pending' && (role === 'admin' || r.target_member_id === loggedInMember?.id)
    );
  }, [allRequests, loggedInMember, role]);

  const terkirimRequests = useMemo(() => {
    return allRequests.filter(
      (r) => r.status === 'pending' && (role === 'admin' || r.requester_id === loggedInMember?.id)
    );
  }, [allRequests, loggedInMember, role]);

  const riwayatRequests = useMemo(() => {
    return allRequests.filter((r) => r.status !== 'pending');
  }, [allRequests]);

  const targetMemberObj = members.find((m) => m.id === targetMemberId);

  return (
    <div className="space-y-6">
      <TopBar title="Tukar Jadwal Piket" />

      {/* Form Buat Permintaan Tukar */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Ajukan Penukaran Jadwal</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Tukar jadwal piket Anda dengan anggota lain tanpa merusak rotasi hari berikutnya.
          </p>
        </div>

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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Pengaju Otomatis */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Pengaju (Akun Anda)
              </label>
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-xs"
                  style={{ backgroundColor: loggedInMember?.avatar_color || '#a855f7' }}
                >
                  {loggedInMember?.avatar_url ? (
                    <img src={loggedInMember.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    loggedInMember?.name?.charAt(0) || 'U'
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">
                    {loggedInMember?.name || 'Belum Terhubung'}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">Anggota Terjadwal</p>
                </div>
              </div>
            </div>

            {/* Pilih Anggota Tujuan */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Tukar Dengan Anggota
              </label>
              <select
                value={targetMemberId}
                onChange={(e) => setTargetMemberId(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:bg-white focus:border-black transition-all"
              >
                {availableTargetMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tanggal Jadwal Pengaju */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Jadwal Piket Anda
              </label>
              {requesterUpcomingDates.length === 0 ? (
                <div className="p-3 bg-gray-50 rounded-2xl text-xs text-gray-400 font-medium">
                  Tidak ada jadwal mendatang Anda
                </div>
              ) : (
                <select
                  value={requesterDate}
                  onChange={(e) => setRequesterDate(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:bg-white focus:border-black transition-all"
                >
                  {requesterUpcomingDates.map((d) => (
                    <option key={d.dateStr} value={d.dateStr}>
                      {d.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Tanggal Anggota Tujuan & Pratinjau Dampak */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Jadwal Piket Anggota Tujuan ({targetMemberObj?.name || 'Tujuan'})
              </label>
              {targetUpcomingDates.length === 0 ? (
                <div className="p-3 bg-gray-50 rounded-2xl text-xs text-gray-400 font-medium">
                  Tidak ada jadwal mendatang anggota tujuan
                </div>
              ) : (
                <select
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:bg-white focus:border-black transition-all"
                >
                  {targetUpcomingDates.map((d) => (
                    <option key={d.dateStr} value={d.dateStr}>
                      {d.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Pratinjau Sebelum -> Sesudah */}
            {requesterDate && targetDate && (
              <div className="p-4 bg-purple-50/70 border border-purple-100 rounded-2xl space-y-2">
                <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider block flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Pratinjau Pertukaran:
                </span>
                <div className="text-xs space-y-1 text-gray-800">
                  <p>
                    • Tanggal <strong>{requesterDate}</strong>: Semula{' '}
                    <span className="line-through text-gray-400">{loggedInMember?.name}</span> ➔ menjadi{' '}
                    <strong className="text-purple-700">{targetMemberObj?.name}</strong>
                  </p>
                  <p>
                    • Tanggal <strong>{targetDate}</strong>: Semula{' '}
                    <span className="line-through text-gray-400">{targetMemberObj?.name}</span> ➔ menjadi{' '}
                    <strong className="text-purple-700">{loggedInMember?.name}</strong>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button
              type="submit"
              disabled={submitting || !loggedInMember || !requesterDate || !targetDate}
              className="px-6 py-3 bg-[#141416] hover:bg-black text-white text-xs font-bold rounded-full shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowLeftRight className="w-4 h-4 text-purple-400" />
              <span>{submitting ? 'Mengirim...' : 'Kirim Permintaan Tukar'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Tabs Menu Permintaan */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 text-xs font-bold">
          <button
            onClick={() => setActiveTab('masuk')}
            className={`flex-1 py-4 text-center transition-all flex items-center justify-center gap-2 ${
              activeTab === 'masuk'
                ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/20'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Permintaan Masuk</span>
            {masukRequests.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-600 text-white">
                {masukRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('terkirim')}
            className={`flex-1 py-4 text-center transition-all flex items-center justify-center gap-2 ${
              activeTab === 'terkirim'
                ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/20'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Permintaan Terkirim</span>
            {terkirimRequests.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-800 text-white">
                {terkirimRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('riwayat')}
            className={`flex-1 py-4 text-center transition-all ${
              activeTab === 'riwayat'
                ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/20'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Riwayat Tukar ({riwayatRequests.length})</span>
          </button>
        </div>

        {/* Content list */}
        <div className="p-6">
          {loadingRequests ? (
            <div className="p-12 text-center text-xs font-bold text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
              Memuat data pertukaran...
            </div>
          ) : activeTab === 'masuk' ? (
            masukRequests.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold text-gray-400">
                Tidak ada permintaan tukar jadwal yang menunggu konfirmasi Anda.
              </div>
            ) : (
              <div className="space-y-4">
                {masukRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 rounded-2xl border border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-900">
                          {req.requester?.name || 'Anggota'}
                        </span>
                        <span className="text-[10px] text-gray-400">mengajukan penukaran jadwal:</span>
                      </div>
                      <p className="text-xs text-gray-700">
                        Piket Anda pada <strong>{req.date_target}</strong> ditukar dengan piket miliknya pada{' '}
                        <strong>{req.date_requester}</strong>.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRejectAction(req.id)}
                        disabled={processingId === req.id}
                        className="px-4 py-2 rounded-full text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-all disabled:opacity-50"
                      >
                        Tolak
                      </button>
                      <button
                        onClick={() => handleApproveAction(req.id)}
                        disabled={processingId === req.id}
                        className="px-5 py-2 rounded-full text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-all disabled:opacity-50"
                      >
                        {processingId === req.id ? 'Memproses...' : 'Setujui Tukar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'terkirim' ? (
            terkirimRequests.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold text-gray-400">
                Anda belum memiliki permintaan tukar yang diajukan.
              </div>
            ) : (
              <div className="space-y-4">
                {terkirimRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 rounded-2xl border border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-900">
                          Kepada: {req.target_member?.name || 'Anggota'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold uppercase tracking-wider">
                          Menunggu Persetujuan
                        </span>
                      </div>
                      <p className="text-xs text-gray-700">
                        Jadwal Anda (<strong>{req.date_requester}</strong>) ➔ Jadwalnya (
                        <strong>{req.date_target}</strong>)
                      </p>
                    </div>

                    <button
                      onClick={() => handleCancelAction(req.id)}
                      disabled={processingId === req.id}
                      className="px-4 py-2 rounded-full text-xs font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 transition-all disabled:opacity-50"
                    >
                      {processingId === req.id ? 'Membatalkan...' : 'Batalkan'}
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : riwayatRequests.length === 0 ? (
            <div className="p-12 text-center text-xs font-bold text-gray-400">
              Belum ada riwayat permintaan tukar jadwal yang diproses.
            </div>
          ) : (
            <div className="space-y-3">
              {riwayatRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl border border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-gray-900">
                      {req.requester?.name} ⇄ {req.target_member?.name}
                    </p>
                    <p className="text-gray-500 text-[11px]">
                      Tanggal: {req.date_requester} tukar dengan {req.date_target}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider self-start sm:self-auto ${
                      req.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : req.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800'
                        : req.status === 'cancelled'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
