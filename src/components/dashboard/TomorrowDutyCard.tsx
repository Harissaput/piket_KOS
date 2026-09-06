'use client';

import React from 'react';
import { MoreVertical } from 'lucide-react';
import { Member } from '@/types/database';

interface TomorrowDutyCardProps {
  member?: Member | null;
}

export default function TomorrowDutyCard({ member }: TomorrowDutyCardProps) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/80">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Piket Besok</h2>
        <button className="text-gray-400 hover:text-gray-600 transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {member ? (
        <div className="flex items-center gap-4 mt-2">
          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-blue-200 shadow-sm flex-shrink-0 bg-blue-50 p-0.5">
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-lg font-bold">
                {member.name[0]}
              </div>
            )}
          </div>
          <span className="text-2xl font-bold text-gray-900">{member.name}</span>
        </div>
      ) : (
        <p className="text-sm font-semibold text-gray-500 mt-2">
          Libur piket (Tidak ada jadwal)
        </p>
      )}
    </div>
  );
}
