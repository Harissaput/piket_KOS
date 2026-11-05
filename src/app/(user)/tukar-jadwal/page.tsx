'use client';

import React, { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { ArrowLeftRight, Check, X, Clock, AlertCircle } from 'lucide-react';
import { useMembers } from '@/hooks/useMembers';
import { useSettings } from '@/hooks/useSettings';
import { useSwapRequests } from '@/hooks/useSwapRequests';
import { useAuth } from '@/context/AuthContext';
import { formatLocalDate } from '@/lib/utils/date';
import { addDays, parseISO, isBefore, startOfDay } from 'date-fns';

export default function TukarJadwalPage() {
  const { member: loggedInMember, role } = useAuth();
  const { members } = useMembers();
  const { hariLibur } = useSettings();

  const {
    allRequests,
    handleCreateRequest,
    handleApprove,
    handleReject,
    isLoading: loadingRequests,
  } = useSwapRequests();

  // Dynamic default dates based on today
  const today = new Date();
  const defaultRequesterDate = formatLocalDate(addDays(today, 1));
  const defaultTargetDate = formatLocalDate(addDays(today, 2));

  // Available target members = other active members
  const availableTargetMembers = members.filter(
    (m) => m.status_aktif && m.id !== loggedInMember?.id
  );

  const [targetMemberId, setTargetMemberId] = useState('');
  const [requesterDate, setRequesterDate] = useState(defaultRequesterDate);
  const [targetDate, setTargetDate] = useState(defaultTargetDate);
  const [successMsg, setSuccessMsg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Set default target member once members load
  useEffect(() => {
    if (availableTargetMembers.length > 0 && !targetMemberId) {
      setTargetMemberId(availableTargetMembers[0].id);
    }
  }, [availableTargetMembers, targetMemberId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!loggedInMember) {
      setErrorMsg('Akun Anda belum terhubung dengan slot anggota piket.');
      return;
    }

    if (!targetMemberId) {
      setErrorMsg('Silakan pilih anggota tujuan tukar.');
      return;
    }

    if (requesterDate === targetDate) {
      setErrorMsg('Tanggal piket yang ditukar tidak boleh sama.');
      return;
    }

    const todayStart = startOfDay(new Date());
    if (isBefore(parseISO(requesterDate), todayStart) || isBefore(parseISO(targetDate), todayStart)) {
      setErrorMsg('Tanggal piket tidak boleh di masa lalu.');
      return;
    }

    // Check holiday (Minggu)
    if (hariLibur === 'Minggu') {
      if (parseISO(requesterDate).getDay() === 0 || parseISO(targetDate).getDay() === 0) {
        setErrorMsg('Tidak dapat menukar pada hari libur (Minggu).');
        return;
      }
    }

    setSubmitting(true);
    try {
      await handleCreateRequest({
        targetMemberId,
        dateRequester: requesterDate,
        dateTarget: targetDate,
      });
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal mengirim permintaan tukar jadwal.');
    } finally {
      setSubmitting(false);
    }
  };

  const onApprove = async (id: string) => {
    setProcessingId(id);
    setErrorMsg('');
    try {
      await handleApprove(id);
    } catch (err: any) {
      console.error('Error approving swap:', err);
      setErrorMsg(err.message || 'Gagal menyetujui permintaan tukar.');
    } finally {
      setProcessingId(null);
    }
  };

  const onReject = async (id: string) => {
    setProcessingId(id);
    setErrorMsg('');
    try {
      await handleReject(id);
    } catch (err: any) {
      console.error('Error rejecting swap:', err);
      setErrorMsg(err.message || 'Gagal menolak permintaan tukar.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <TopBar title="Tukar Jadwal Piket" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Swap Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Form Permintaan Tukar</h2>
              <p className="text-xs text-gray-500 font-medium">
                Pilih tanggal piket Anda dan ajukan tukar ke anggota lain
              </p>
            </div>
          </div>

          {successMsg && (
            <div className="p-4 bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-semibold rounded-2xl flex items-center gap-2 border border-emerald-200">
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>Permintaan tukar jadwal berhasil dikirim! Menunggu konfirmasi.</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-rose-50 text-rose-800 text-xs sm:text-sm font-semibold rounded-2xl flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Logged in Requester Info */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Pengaju (Akun Anda)
              </label>
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-white">
                  <img
                    src={
                      loggedInMember?.avatar_url ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${loggedInMember?.name || 'A'}`
                    }
                    alt={loggedInMember?.name || 'User'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">
                    {loggedInMember?.name || 'Tidak ada anggota tertaut'}
                  </p>
                  <p className="text-[10px] text-gray-500">Otomatis terhubung dari sesi login Anda</p>
                </div>
              </div>
            </div>

            {/* Tanggal Pengaju */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                1. Tanggal Piket Anda yang Ingin Ditukar
              </label>
              <input
                type="date"
                required
                value={requesterDate}
                onChange={(e) => setRequesterDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200 text-xs sm:text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:bg-white"
              />
            </div>

            {/* Anggota Tujuan */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                2. Pilih Anggota Tujuan Tukar
              </label>
              {availableTargetMembers.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Tidak ada anggota lain yang aktif.</p>
              ) : (
                <select
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200 text-xs sm:text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:bg-white"
                >
                  {availableTargetMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Tanggal Target */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                3. Tanggal Piket Pengganti (Milik Teman)
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200 text-xs sm:text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !loggedInMember}
              className="w-full py-4 px-6 bg-black hover:bg-gray-800 text-white rounded-full font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Kirim Permintaan Tukar</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Swap Request List */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Status Permintaan Tukar</h2>
            <span className="text-xs font-bold text-gray-400">{allRequests.length} total</span>
          </div>

          {loadingRequests ? (
            <div className="py-12 text-center text-xs font-bold text-gray-400">
              Memuat permintaan...
            </div>
          ) : allRequests.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-500">Belum ada permintaan tukar jadwal</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Gunakan form di samping untuk membuat permintaan tukar baru.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {allRequests.map((req) => {
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const isRejected = req.status === 'rejected';
                const isBusy = processingId === req.id;

                // Authorization: only target member or admin can approve/reject
                const canRespond =
                  isPending &&
                  loggedInMember &&
                  (req.target_member_id === loggedInMember.id || role === 'admin');
                const isRequester = loggedInMember && req.requester_id === loggedInMember.id;

                return (
                  <div
                    key={req.id}
                    className={`p-4 rounded-2xl border space-y-3 transition-all ${
                      isPending
                        ? 'bg-amber-50/70 border-amber-200'
                        : isApproved
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-rose-50/60 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold flex items-center gap-1.5 ${
                          isPending
                            ? 'text-amber-800'
                            : isApproved
                            ? 'text-emerald-800'
                            : 'text-rose-800'
                        }`}
                      >
                        {isPending && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                        {isApproved && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        {isRejected && <X className="w-3.5 h-3.5 text-rose-600" />}
                        {isPending ? 'Menunggu Konfirmasi' : isApproved ? 'Disetujui' : 'Ditolak'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {req.created_at ? req.created_at.slice(0, 10) : 'Terbaru'}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-gray-800 leading-relaxed">
                      <span className="font-bold text-black">{req.requester?.name || 'Anggota'}</span>{' '}
                      tukar <span className="font-bold text-black">{req.date_requester}</span> dengan{' '}
                      <span className="font-bold text-black">{req.target_member?.name || 'Anggota'}</span>{' '}
                      <span className="font-bold text-black">{req.date_target}</span>.
                    </p>

                    {/* Action buttons if current user is the target or admin */}
                    {canRespond ? (
                      <div className="flex gap-2 pt-2 border-t border-amber-200/50">
                        <button
                          onClick={() => onApprove(req.id)}
                          disabled={isBusy}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" /> {isBusy ? '...' : 'Setuju'}
                        </button>
                        <button
                          onClick={() => onReject(req.id)}
                          disabled={isBusy}
                          className="flex-1 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold rounded-full transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" /> {isBusy ? '...' : 'Tolak'}
                        </button>
                      </div>
                    ) : isPending && isRequester ? (
                      <p className="text-[11px] text-amber-700 font-medium italic pt-1 border-t border-amber-200/40">
                        Menunggu tanggapan dari {req.target_member?.name || 'anggota tujuan'}.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
