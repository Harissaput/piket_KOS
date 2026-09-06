'use client';

import React from 'react';
import { ScrollText, CheckCircle2 } from 'lucide-react';
import { useRules } from '@/hooks/useRules';

export default function RulesCard() {
  const { rules, isLoading } = useRules();

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/80">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
            <ScrollText className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Papan Peraturan</h2>
        </div>
        <span className="text-[11px] font-extrabold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
          {rules.length} Aturan
        </span>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-xs font-semibold text-gray-400">
          Memuat peraturan...
        </div>
      ) : rules.length === 0 ? (
        <div className="py-6 text-center text-xs font-semibold text-gray-400">
          Belum ada peraturan kost yang ditetapkan.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
          {rules.map((rule, idx) => (
            <div
              key={rule.id}
              className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-gray-50/80 border border-gray-100 hover:bg-gray-100/60 transition-colors"
            >
              <div className="mt-0.5 text-emerald-600 flex-shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-gray-800 leading-relaxed">
                {rule.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
