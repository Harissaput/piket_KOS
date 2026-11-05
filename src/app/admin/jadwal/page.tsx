'use client';

import React, { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useMembers } from '@/hooks/useMembers';
import { useSettings } from '@/hooks/useSettings';
import { useSchedule } from '@/hooks/useSchedule';
import { ScheduleOverride, Member } from '@/types/database';
import { formatLocalDate } from '@/lib/utils/date';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Clock,
  ArrowRightLeft,
} from 'lucide-react';

export default function AdminJadwalPage() {
  const { user: currentUser } = useAuth();
  const { members } = useMembers();
  const { startDate } = useSettings();
  const {
    weeklySchedule,
    currentWeekDate,
    goToPrevWeek,
    goToNextWeek,
  } = useSchedule(members, startDate);

  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [overrideDate, setOverrideDate] = useState(formatLocalDate(new Date()));
  const [originalMemberId, setOriginalMemberId] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [reason, setReason] = useState<'manual' | 'izin'>('manual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  // Set default original member once members are loaded
  useEffect(() => {
    if (members.length > 0 && !originalMemberId) {
      setOriginalMemberId(members[0].id);
      setNewMemberId(members[1]?.id || members[0].id);
    }
  }, [members, originalMemberId]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchOverrides = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('schedule_overrides')
        .select(`
          *,
          original_member:members!original_member_id(*),
          new_member:members!new_member_id(*),
          creator_profile:profiles!created_by(full_name, email)
        `)
        .order('date', { ascending: false })
        .limit(20);

      if (error) {
        console.warn('Error fetching overrides:', error.message);
      } else if (data) {
        setOverrides(data as unknown as ScheduleOverride[]);
      }
    } catch (err) {
      console.warn('Exception fetching overrides:', err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchOverrides();

    const channel = supabase
      .channel('admin-schedule-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_overrides' }, () => {
        fetchOverrides();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOverrides, supabase]);

  const handleCreateOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideDate || !originalMemberId) return;

    if (reason === 'manual' && originalMemberId === newMemberId) {
      showFeedback('error', 'Anggota asli dan pengganti tidak boleh sama untuk override manual.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        date: overrideDate,
        original_member_id: originalMemberId,
        new_member_id: reason === 'izin' && !newMemberId ? null : newMemberId,
        reason,
        created_by: currentUser?.id,
      };

      const { error } = await supabase.from('schedule_overrides').insert(payload);
      if (error) throw error;

      showFeedback('success', 'Override jadwal manual berhasil dibuat!');
      fetchOverrides();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal membuat override');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    try {
      const { error } = await supabase
        .from('schedule_overrides')
        .delete()
        .eq('id', overrideId);

      if (error) throw error;
      showFeedback('success', 'Override jadwal berhasil dihapus.');
      fetchOverrides();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menghapus override');
    }
  };

  return (
    <div className="space-y-6">
      <TopBar title="Jadwal & Override Manual" />

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

      {/* Week View Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Jadwal Mingguan Berjalan</h2>
            <p className="text-xs text-gray-500 font-medium">
              Lihat rotasi aktif dan penyesuaian override
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-full border border-gray-200">
          <button
            onClick={goToPrevWeek}
            className="p-2 rounded-full hover:bg-white hover:shadow-sm text-gray-700 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-gray-800 px-4">
            {weeklySchedule.length > 0 && (
              <>
                {format(weeklySchedule[0].date, 'd MMM', { locale: idLocale })} -{' '}
                {format(weeklySchedule[6].date, 'd MMM yyyy', { locale: idLocale })}
              </>
            )}
          </span>
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-full hover:bg-white hover:shadow-sm text-gray-700 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 7-Day Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weeklySchedule.map((day, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-3xl border flex flex-col justify-between min-h-[160px] ${
              day.isLibur
                ? 'bg-gray-50/60 border-dashed border-gray-200'
                : day.override
                ? 'bg-purple-50/50 border-purple-200'
                : 'bg-white border-gray-100 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  {day.dayName}
                </span>
                <span className="text-xs font-black bg-gray-100 px-2 py-0.5 rounded-full text-gray-800">
                  {day.dayNumber}
                </span>
              </div>

              {day.isLibur ? (
                <div className="py-6 text-center">
                  <span className="text-xs font-bold text-gray-400">Libur</span>
                </div>
              ) : (
                day.member && (
                  <div className="space-y-1.5 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full overflow-hidden border border-gray-200 flex-shrink-0">
                        <img
                          src={
                            day.member.avatar_url ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${day.member.name}`
                          }
                          alt={day.member.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-900 truncate">
                        {day.member.name}
                      </span>
                    </div>

                    {day.override && (
                      <span className="inline-block text-[10px] font-extrabold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        Override ({day.override.reason})
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Override Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Create Manual Override Form */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Buat Override Manual</h3>
              <p className="text-xs text-gray-500 font-medium">
                Ganti petugas piket atau tandai izin
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateOverride} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Tanggal Piket
              </label>
              <input
                type="date"
                required
                value={overrideDate}
                onChange={(e) => setOverrideDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Alasan Override
              </label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value="manual"
                    checked={reason === 'manual'}
                    onChange={() => setReason('manual')}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  Manual (Tukar Petugas)
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value="izin"
                    checked={reason === 'izin'}
                    onChange={() => setReason('izin')}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  Izin (Tanpa Pengganti / Izin)
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Petugas Asli
              </label>
              <select
                value={originalMemberId}
                onChange={(e) => setOriginalMemberId(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {reason === 'manual' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Petugas Pengganti
                </label>
                <select
                  value={newMemberId}
                  onChange={(e) => setNewMemberId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-6 bg-black hover:bg-gray-800 text-white rounded-full font-bold text-xs shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Terapkan Override'}
            </button>
          </form>
        </div>

        {/* Existing Overrides Table */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-base font-bold text-gray-900">Daftar Override Terkini</h3>
            <span className="text-xs text-gray-400 font-semibold">{overrides.length} tercatat</span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {overrides.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400 font-medium">
                Belum ada override yang tercatat.
              </div>
            ) : (
              overrides.map((ov: any) => (
                <div
                  key={ov.id}
                  className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{ov.date}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase">
                        {ov.reason}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1 font-medium">
                      {ov.original_member?.name || 'Anggota'}
                      {ov.new_member ? ` → ${ov.new_member.name}` : ' (Izin)'}
                    </p>
                    {ov.creator_profile && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Oleh: {ov.creator_profile.full_name}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteOverride(ov.id)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Hapus override"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
