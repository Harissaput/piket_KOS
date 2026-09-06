'use client';

import React, { useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { useCompletionLogs } from '@/hooks/useCompletionLogs';
import { useSearch } from '@/context/SearchContext';
import { CheckCircle2, XCircle, ArrowLeftRight } from 'lucide-react';

const FALLBACK_LOGS = [
  { id: '1', date: '2026-09-04', memberName: 'Fahrul', status: 'selesai', note: 'Selesai pukul 19:30' },
  { id: '2', date: '2026-09-03', memberName: 'Haris', status: 'selesai', note: 'Selesai tepat waktu' },
  { id: '3', date: '2026-09-02', memberName: 'Ishom', status: 'ditukar', note: 'Ditukar dengan Fahrul' },
  { id: '4', date: '2026-09-01', memberName: 'Fahrul', status: 'terlewat', note: 'Lupa konfirmasi' },
  { id: '5', date: '2026-08-31', memberName: 'Haris', status: 'selesai', note: 'Selesai pukul 20:00' },
];

export default function RiwayatPiketPage() {
  const [filterMember, setFilterMember] = useState('Semua');
  const { logs, isLoading } = useCompletionLogs();
  const { searchQuery } = useSearch();

  const displayLogs = logs.length > 0
    ? logs.map((l) => ({
        id: l.id,
        date: l.date,
        memberName: l.member?.name || 'Anggota',
        status: l.status,
        note: l.note || '-',
      }))
    : FALLBACK_LOGS;

  // Filter by Member Pill AND Search Query
  const filteredLogs = displayLogs.filter((log) => {
    const matchesMember = filterMember === 'Semua' || log.memberName === filterMember;
    const matchesSearch = !searchQuery ||
      log.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.date.includes(searchQuery) ||
      log.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.note.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMember && matchesSearch;
  });

  const totalSelesai = displayLogs.filter((l) => l.status === 'selesai').length;
  const totalTerlewat = displayLogs.filter((l) => l.status === 'terlewat').length;
  const totalTukar = displayLogs.filter((l) => l.status === 'ditukar').length;

  return (
    <div className="space-y-6">
      <TopBar title="Riwayat Piket" />

      {/* Filter Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-bold text-gray-900">Catatan Aktivitas Piket</h2>

          {/* Member Filter Pills */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full">
            {['Semua', 'Haris', 'Fahrul', 'Ishom'].map((name) => (
              <button
                key={name}
                onClick={() => setFilterMember(name)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  filterMember === name
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Anggota</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400 text-xs font-semibold">
                    Tidak ditemukan data yang sesuai pencarian.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-4 font-semibold text-gray-900">{log.date}</td>
                    <td className="py-4 px-4 font-bold text-gray-800">{log.memberName}</td>
                    <td className="py-4 px-4">
                      {log.status === 'selesai' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                        </span>
                      )}
                      {log.status === 'terlewat' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full">
                          <XCircle className="w-3.5 h-3.5" /> Terlewat
                        </span>
                      )}
                      {log.status === 'ditukar' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full">
                          <ArrowLeftRight className="w-3.5 h-3.5" /> Ditukar
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-gray-500 text-xs">{log.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
