'use client';

import React, { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { useMembers } from '@/hooks/useMembers';
import { CompletionLog, MemberStatus } from '@/types/database';
import {
  History,
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  Edit2,
  Check,
  AlertCircle,
  Search,
  Filter,
  Trash2,
} from 'lucide-react';

export default function AdminRiwayatPage() {
  const { members } = useMembers();
  const [logs, setLogs] = useState<CompletionLog[]>([]);
  const [filterMember, setFilterMember] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Edit State
  const [editingLog, setEditingLog] = useState<CompletionLog | null>(null);
  const [editStatus, setEditStatus] = useState<MemberStatus>('selesai');
  const [editNote, setEditNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('completion_logs')
        .select('*, member:members(*)')
        .order('date', { ascending: false });

      if (error) throw error;
      if (data) setLogs(data as CompletionLog[]);
    } catch (err: any) {
      console.warn('Error fetching logs:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('admin-riwayat-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completion_logs' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs, supabase]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const openEditModal = (log: CompletionLog) => {
    setEditingLog(log);
    setEditStatus(log.status);
    setEditNote(log.note || '');
  };

  const handleSaveCorrection = async () => {
    if (!editingLog) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('completion_logs')
        .update({
          status: editStatus,
          note: editNote.trim() || null,
          completed_at: editStatus === 'selesai' ? new Date().toISOString() : null,
        })
        .eq('id', editingLog.id);

      if (error) throw error;

      showFeedback('success', `Status log tanggal ${editingLog.date} berhasil dikoreksi!`);
      setEditingLog(null);
      fetchLogs();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal mengoreksi log');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Yakin ingin menghapus baris log ini?')) return;

    try {
      const { error } = await supabase
        .from('completion_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;
      showFeedback('success', 'Log berhasil dihapus.');
      fetchLogs();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menghapus log');
    }
  };

  // Filter & Search
  const filteredLogs = logs.filter((l) => {
    const matchesMember =
      filterMember === 'Semua' || l.member?.name === filterMember;
    const matchesStatus =
      filterStatus === 'Semua' || l.status.toLowerCase() === filterStatus.toLowerCase();
    const matchesSearch =
      !search ||
      l.member?.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.date.includes(search) ||
      (l.note && l.note.toLowerCase().includes(search.toLowerCase()));
    return matchesMember && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <TopBar title="Koreksi Riwayat Piket" />

      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-bold shadow-sm transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
        {/* Filters Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-full overflow-x-auto">
              {['Semua', 'Selesai', 'Terlewat', 'Izin', 'Ditukar'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    filterStatus === st
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Member Dropdown */}
            <select
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
              className="px-3 py-1.5 bg-gray-100 rounded-full text-xs font-bold text-gray-700 border-none focus:outline-none"
            >
              <option value="Semua">Semua Anggota</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari tanggal, nama, catatan..."
              className="pl-9 pr-4 py-2 text-xs font-semibold bg-gray-50 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10 w-full sm:w-60"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Anggota</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Catatan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 font-semibold">
                    Memuat catatan riwayat...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 font-semibold">
                    Tidak ditemukan data riwayat piket.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-4 font-bold text-gray-900">{log.date}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-200">
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-[11px] font-bold rounded-full">
                          Belum
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-gray-500 max-w-xs truncate">
                      {log.note || '-'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(log)}
                          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
                          title="Koreksi status log"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-1.5 rounded-full hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors"
                          title="Hapus baris log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Koreksi Log */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                Koreksi Riwayat Piket
              </h3>
              <button
                onClick={() => setEditingLog(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl text-xs space-y-1">
              <p>
                <span className="text-gray-400 font-medium">Tanggal:</span>{' '}
                <span className="font-bold text-gray-900">{editingLog.date}</span>
              </p>
              <p>
                <span className="text-gray-400 font-medium">Anggota:</span>{' '}
                <span className="font-bold text-gray-900">
                  {editingLog.member?.name || 'Anggota'}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Status Baru
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as MemberStatus)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900"
              >
                <option value="selesai">Selesai</option>
                <option value="terlewat">Terlewat</option>
                <option value="izin">Izin</option>
                <option value="ditukar">Ditukar</option>
                <option value="belum">Belum</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Catatan Koreksi Admin
              </label>
              <textarea
                rows={3}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Alasan koreksi, contoh: Surat izin dokter terlampir"
                className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingLog(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                disabled={isSaving}
                onClick={handleSaveCorrection}
                className="flex-1 py-2.5 bg-black text-white rounded-full text-xs font-bold hover:bg-gray-800 disabled:opacity-50"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Koreksi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
