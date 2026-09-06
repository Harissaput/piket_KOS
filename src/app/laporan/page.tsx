'use client';

import React from 'react';
import TopBar from '@/components/layout/TopBar';
import { useMembers } from '@/hooks/useMembers';
import { useCompletionLogs } from '@/hooks/useCompletionLogs';
import { INITIAL_MEMBERS } from '@/lib/constants/members';
import { useSearch } from '@/context/SearchContext';

export default function LaporanPage() {
  const { members } = useMembers();
  const { logs, isLoading } = useCompletionLogs();
  const { searchQuery } = useSearch();

  const activeMembers = members.length > 0 ? members : INITIAL_MEMBERS;

  const filteredMembers = searchQuery
    ? activeMembers.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : activeMembers;

  return (
    <div className="space-y-6">
      <TopBar title="Laporan & Performa Piket" />

      {/* Overview Cards per Member calculated dynamically from Supabase database logs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredMembers.map((member, idx) => {
          const memberLogs = logs.filter((l) => l.member_id === member.id || l.member?.name === member.name);
          const totalSelesai = memberLogs.filter((l) => l.status === 'selesai').length;
          const totalTerlewat = memberLogs.filter((l) => l.status === 'terlewat').length;
          const totalPiket = memberLogs.length;

          // Discipline percentage calculation
          const disciplineRate = totalPiket > 0 ? Math.round((totalSelesai / totalPiket) * 100) : 100;

          return (
            <div key={member.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-purple-200 shadow-sm bg-purple-50 p-0.5">
                <img src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`} alt={member.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{member.name}</h3>
                  <p className="text-xs text-gray-500 font-medium">Anggota #{idx + 1}</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-500">Tingkat Kedisiplinan:</span>
                  <span className="text-emerald-600 font-extrabold">{disciplineRate}%</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${disciplineRate}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center pt-2">
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-400 font-semibold">Selesai</p>
                  <p className="text-lg font-black text-gray-900">{totalSelesai} Piket</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-400 font-semibold">Terlewat</p>
                  <p className="text-lg font-black text-gray-900">{totalTerlewat}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
