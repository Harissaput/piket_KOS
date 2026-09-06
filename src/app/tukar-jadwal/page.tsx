'use client';

import React, { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { ArrowLeftRight, Check, X, Clock } from 'lucide-react';
import { useMembers } from '@/hooks/useMembers';
import { useSwapRequests } from '@/hooks/useSwapRequests';
import { INITIAL_MEMBERS } from '@/lib/constants/members';

export default function TukarJadwalPage() {
  const { members } = useMembers();
  const activeMembers = members.length > 0 ? members : INITIAL_MEMBERS;

  const {
    pendingRequests,
    allRequests,
    handleCreateRequest,
    handleApprove,
    handleReject,
  } = useSwapRequests();

  const [requesterMemberId, setRequesterMemberId] = useState(activeMembers[0]?.id || 'm1');
  const [requesterDate, setRequesterDate] = useState('2026-09-07');
  const [targetMemberId, setTargetMemberId] = useState(activeMembers[1]?.id || 'm2');
  const [targetDate, setTargetDate] = useState('2026-09-08');
  const [successMsg, setSuccessMsg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (requesterMemberId === targetMemberId) {
      setErrorMsg('Pengaju dan anggota tujuan tukar tidak boleh sama.');
      return;
    }

    if (requesterDate === targetDate) {
      setErrorMsg('Tanggal piket yang ditukar tidak boleh sama.');
      return;
    }

    setSubmitting(true);
    try {
      await handleCreateRequest({
        requesterId: requesterMemberId,
        targetMemberId,
        dateRequester: requesterDate,
        dateTarget: targetDate,
      });
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 4000);
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal mengirim permintaan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const onApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await handleApprove(id);
    } catch (err) {
      console.error('Error approving swap:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const onReject = async (id: string) => {
    setProcessingId(id);
    try {
      await handleReject(id);
    } catch (err) {
      console.error('Error rejecting swap:', err);
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
                Pilih tanggal piket Anda dan tentukan tanggal pengganti milik teman
              </p>
            </div>
          </div>

          {successMsg && (
            <div className="p-4 bg-emerald-50 text-emerald-800 text-sm font-semibold rounded-2xl flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" />
              Permintaan tukar jadwal berhasil dikirim! Menunggu konfirmasi.
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-rose-50 text-rose-800 text-sm font-semibold rounded-2xl flex items-center gap-2">
              <X className="w-5 h-5 text-rose-600" />
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Diajukan Oleh
              </label>
              <select
                value={requesterMemberId}
                onChange={(e) => setRequesterMemberId(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                1. Tanggal Piket Anda yang Ingin Ditukar
              </label>
              <input
                type="date"
                value={requesterDate}
                onChange={(e) => setRequesterDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                2. Pilih Anggota Tujuan Tukar
              </label>
              <select
                value={targetMemberId}
                onChange={(e) => setTargetMemberId(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                3. Tanggal Piket Pengganti
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 px-6 bg-black hover:bg-gray-800 text-white rounded-full font-bold text-sm shadow-md transition-all disabled:opacity-50"
            >
              {submitting ? 'Mengirim...' : 'Kirim Permintaan Tukar'}
            </button>
          </form>
        </div>

        {/* Swap Request Log */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Status Permintaan Tukar</h2>

          {allRequests.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-500">Belum ada permintaan tukar jadwal</p>
              <p className="text-[11px] text-gray-400 mt-1">Gunakan form di samping untuk membuat permintaan tukar baru.</p>
            </div>
          ) : (
            allRequests.map((req) => {
              const isPending = req.status === 'pending';
              const isApproved = req.status === 'approved';
              const isRejected = req.status === 'rejected';
              const isBusy = processingId === req.id;

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

                  <p className="text-xs font-semibold text-gray-800">
                    <span className="font-bold text-black">{req.requester?.name || 'Anggota'}</span> tukar{' '}
                    <span className="font-bold text-black">{req.date_requester}</span> dengan{' '}
                    <span className="font-bold text-black">{req.target_member?.name || 'Anggota'}</span>{' '}
                    <span className="font-bold text-black">{req.date_target}</span>.
                  </p>

                  {isPending && (
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
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
