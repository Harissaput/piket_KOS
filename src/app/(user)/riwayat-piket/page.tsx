'use client';

import React, { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { useCompletionLogs } from '@/hooks/useCompletionLogs';
import { useMembers } from '@/hooks/useMembers';
import { useAuth } from '@/context/AuthContext';
import { useSearch } from '@/context/SearchContext';
import { createClient } from '@/lib/supabase/client';
import { formatLocalDate } from '@/lib/utils/date';
import {
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  Clock,
  Plus,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export default function RiwayatPiketPage() {
  const [filterMember, setFilterMember] = useState('Semua');
  const { logs, isLoading, error, refetch } = useCompletionLogs();
  const { members } = useMembers();
  const { member: loggedInMember } = useAuth();
  const { searchQuery } = useSearch();

  // Modal tandai izin mandiri
  const [showIzinModal, setShowIzinModal] = useState(false);
  const [izinDate, setIzinDate] = useState(formatLocalDate(new Date()));
  const [izinNote, setIzinNote] = useState('');
  const [isSubmittingIzin, setIsSubmittingIzin] = useState(false);
  const [izinFeedback, setIzinFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  const handleAjukanIzin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInMember) {
      setIzinFeedback({ type: 'error', text: 'Akun Anda belum terhubung dengan slot anggota' });
      return;
    }

    setIsSubmittingIzin(true);
    try {
      // 1. Catat di schedule_overrides sebagai izin
      const { error: ovError } = await supabase.from('schedule_overrides').insert({
        date: izinDate,
        original_member_id: loggedInMember.id,
        new_member_id: null,
        reason: 'izin',
      });
      if (ovError) throw ovError;

      // 2. Catat di completion_logs sebagai izin
      const { error: logError } = await supabase.from('completion_logs').upsert(
        {
          date: izinDate,
          member_id: loggedInMember.id,
          status: 'izin',
          note: izinNote.trim() ? `Izin mandiri: ${izinNote.trim()}` : 'Izin tidak dapat piket',
        },
        { onConflict: 'date,member_id' }
      );
      if (logError) throw logError;

      setIzinFeedback({ type: 'success', text: 'Pemberitahuan izin berhasil dicatat.' });
      refetch();
      setTimeout(() => {
        setShowIzinModal(false);
        setIzinFeedback(null);
        setIzinNote('');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setIzinFeedback({ type: 'error', text: err.message || 'Gagal menandai izin.' });
    } finally {
      setIsSubmittingIzin(false);
    }
  };

  // Filter by Member Pill AND Search Query
  const filteredLogs = logs.filter((log) => {
    const memberName = log.member?.name || 'Anggota';
    const matchesMember = filterMember === 'Semua' || memberName === filterMember;
    const matchesSearch =
      !searchQuery ||
      memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.date.includes(searchQuery) ||
      log.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.note && log.note.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesMember && matchesSearch;
  });

  const totalSelesai = logs.filter((l) => l.status === 'selesai').length;
  const totalTerlewat = logs.filter((l) => l.status === 'terlewat').length;
  const totalTukar = logs.filter((l) => l.status === 'ditukar').length;
  const totalIzin = logs.filter((l) => l.status === 'izin').length;

  return (
    <div className="space-y-6">
      <TopBar title="Riwayat Piket" />

      {/* Filter Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400">Total Selesai</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{totalSelesai} Piket</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400">Terlewat</p>
            <p className="text-2xl font-black text-rose-600 mt-1">{totalTerlewat} Piket</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400">Total Tukar</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{totalTukar} Kali</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400">Total Izin</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{totalIzin} Kali</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">Catatan Aktivitas Piket</h2>
            <button
              onClick={() => setShowIzinModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Tandai Izin Piket
            </button>
          </div>

          {/* Dynamic Member Filter Pills */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-full overflow-x-auto">
            <button
              onClick={() => setFilterMember('Semua')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                filterMember === 'Semua'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Semua
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setFilterMember(m.name)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  filterMember === m.name
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => refetch()}
              className="px-3 py-1 bg-rose-100 hover:bg-rose-200 rounded-lg text-rose-800 font-bold flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Anggota</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400 font-semibold">
                    Memuat catatan riwayat...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400 font-semibold">
                    Belum ada catatan riwayat piket yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-4 font-bold text-gray-900">{log.date}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-200 bg-white">
                          <img
                            src={
                              log.member?.avatar_url ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${log.member?.name || 'A'}`
                            }
                            alt={log.member?.name || 'Anggota'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="font-bold text-gray-800">
                          {log.member?.name || 'Anggota'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {log.status === 'selesai' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                        </span>
                      )}
                      {log.status === 'terlewat' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 text-[11px] font-bold rounded-full">
                          <XCircle className="w-3.5 h-3.5" /> Terlewat
                        </span>
                      )}
                      {log.status === 'izin' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-full">
                          Izin
                        </span>
                      )}
                      {log.status === 'ditukar' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-full">
                          <ArrowLeftRight className="w-3.5 h-3.5" /> Ditukar
                        </span>
                      )}
                      {log.status === 'belum' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded-full">
                          Belum
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-gray-500">{log.note || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tandai Izin Mandiri */}
      {showIzinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">Tandai Izin Piket</h3>
              <button
                onClick={() => setShowIzinModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {izinFeedback && (
              <div
                className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-bold ${
                  izinFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {izinFeedback.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{izinFeedback.text}</span>
              </div>
            )}

            <form onSubmit={handleAjukanIzin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Anggota
                </label>
                <input
                  type="text"
                  disabled
                  value={loggedInMember?.name || 'Akun tidak bertaut'}
                  className="w-full px-4 py-2 bg-gray-100 rounded-xl text-xs font-bold text-gray-700 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tanggal Izin
                </label>
                <input
                  type="date"
                  required
                  value={izinDate}
                  onChange={(e) => setIzinDate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Alasan / Catatan Izin
                </label>
                <textarea
                  rows={2}
                  value={izinNote}
                  onChange={(e) => setIzinNote(e.target.value)}
                  placeholder="Contoh: Sedang sakit / dinas luar kota"
                  className="w-full px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIzinModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold hover:bg-gray-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIzin || !loggedInMember}
                  className="flex-1 py-2.5 bg-black text-white rounded-full text-xs font-bold hover:bg-gray-800 disabled:opacity-50"
                >
                  {isSubmittingIzin ? 'Menyimpan...' : 'Kirim Izin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
