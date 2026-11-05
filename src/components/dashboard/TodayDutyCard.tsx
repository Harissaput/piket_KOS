'use client';

import React, { useState, useEffect } from 'react';
import { Check, ShieldCheck, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { Member, TaskItem } from '@/types/database';
import { upsertCompletionLog, getLogForDate } from '@/services/completion.service';
import { getTasks } from '@/services/settings.service';
import { useAuth } from '@/context/AuthContext';
import { formatLocalDate } from '@/lib/utils/date';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface TodayDutyCardProps {
  member?: Member | null;
  isHoliday?: boolean;
}

export default function TodayDutyCard({ member, isHoliday }: TodayDutyCardProps) {
  const { member: loggedInMember } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const todayStr = formatLocalDate(new Date());
  const dateText = format(new Date(), 'EEEE, d MMM yyyy', { locale: idLocale });

  const isMyDuty = Boolean(
    loggedInMember && member && loggedInMember.id === member.id
  );

  const loadTasksAndState = React.useCallback(async () => {
    setLoadingTasks(true);
    setErrorMsg('');
    try {
      const dbTasks = await getTasks();

      let savedCompletedTaskIds: string[] = [];
      let savedStatus = '';

      if (member) {
        const log = await getLogForDate(member.id, todayStr);
        if (log) {
          savedCompletedTaskIds = log.completed_tasks || [];
          savedStatus = log.status;
        }
      }

      setIsSubmitted(savedStatus === 'selesai');

      const mappedTasks: TaskItem[] = dbTasks.map((t) => ({
        id: t.id,
        name: t.name,
        completed:
          savedCompletedTaskIds.includes(t.id) ||
          savedCompletedTaskIds.includes(t.name),
      }));

      setTasks(mappedTasks);
    } catch (err: any) {
      console.warn('Error loading duty tasks:', err);
      setErrorMsg('Gagal memuat tugas piket dari server.');
    } finally {
      setLoadingTasks(false);
    }
  }, [member, todayStr]);

  useEffect(() => {
    loadTasksAndState();
  }, [loadTasksAndState]);

  const toggleTask = async (id: string) => {
    if (!isMyDuty || isSubmitted) return;

    const updatedTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );
    setTasks(updatedTasks);

    const completedIds = updatedTasks.filter((t) => t.completed).map((t) => t.id);

    if (member) {
      try {
        await upsertCompletionLog(
          member.id,
          todayStr,
          'belum',
          completedIds,
          'Progress tugas diperbarui'
        );
      } catch (err: any) {
        console.warn('Persist task error:', err);
        setErrorMsg('Gagal menyimpan perubahan tugas.');
      }
    }
  };

  const handleMarkComplete = async () => {
    if (!isMyDuty || !member) return;

    setIsSubmitting(true);
    setErrorMsg('');

    const allChecked = tasks.map((t) => ({ ...t, completed: true }));
    setTasks(allChecked);
    const completedIds = allChecked.map((t) => t.id);

    try {
      await upsertCompletionLog(
        member.id,
        todayStr,
        'selesai',
        completedIds,
        'Selesai mengerjakan dari Dashboard'
      );
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Failed to persist completion log:', err);
      setErrorMsg(err.message || 'Gagal menyimpan status selesai.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-full space-y-4">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Piket Hari Ini
            </span>
            <h2 className="text-lg sm:text-xl font-black text-gray-900 capitalize">
              {dateText}
            </h2>
          </div>

          {member && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isMyDuty
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isMyDuty ? 'Giliran Kamu!' : 'Petugas Kost'}
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={loadTasksAndState}
              className="p-1 hover:bg-rose-100 rounded-lg text-rose-700"
              title="Coba lagi"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Member Avatar & Name */}
        {member ? (
          <div className="flex items-center gap-4 mb-6 p-3 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-purple-200 shadow-sm flex-shrink-0 bg-purple-50 p-0.5">
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-purple-500 flex items-center justify-center text-white text-xl font-bold">
                  {member.name[0]}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black text-gray-900 truncate">
                {member.name}
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                {isMyDuty
                  ? 'Kamu bertugas piket hari ini'
                  : `Hari ini giliran ${member.name} yang bertugas`}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-emerald-50 text-emerald-800 rounded-2xl mb-6 text-center border border-emerald-100">
            <span className="text-2xl block mb-1">🎉</span>
            <p className="font-bold text-sm">
              {isHoliday ? 'Hari Ini Libur Piket!' : 'Tidak Ada Jadwal Piket'}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Semua penghuni bebas dari kewajiban piket.
            </p>
          </div>
        )}

        {/* Tasks Section */}
        {member && (
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Daftar Tugas:
              </h4>
              {!isMyDuty && !isSubmitted && (
                <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Hanya-Baca
                </span>
              )}
            </div>

            {loadingTasks ? (
              <div className="space-y-2 py-4 text-center text-xs font-semibold text-gray-400">
                Memuat daftar tugas...
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-xs text-gray-400 italic py-2">
                Belum ada daftar tugas dari admin.
              </div>
            ) : isSubmitted ? (
              <div className="p-5 bg-emerald-50 text-emerald-800 rounded-2xl flex flex-col items-center gap-2 text-center border border-emerald-200">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <p className="font-black text-sm text-emerald-900">Piket Selesai!</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Tugas piket untuk hari ini telah diselesaikan.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <label
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                      isMyDuty
                        ? 'cursor-pointer hover:bg-gray-50 border-gray-100'
                        : 'cursor-default border-transparent'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'bg-[#141416] border-[#141416] text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        task.completed
                          ? 'text-gray-400 line-through'
                          : 'text-gray-800'
                      }`}
                    >
                      {task.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Area */}
      {member && !isSubmitted && (
        <div className="pt-2 border-t border-gray-100">
          {isMyDuty ? (
            <button
              onClick={handleMarkComplete}
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-full font-bold text-xs sm:text-sm shadow-md transition-all duration-200 bg-[#141416] hover:bg-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Selesai Mengerjakan Piket</span>
                </>
              )}
            </button>
          ) : (
            <div className="p-3 bg-gray-50 rounded-2xl text-center text-xs text-gray-500 font-medium border border-gray-100">
              Konfirmasi piket hanya aktif untuk akun petugas ({member.name}).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
