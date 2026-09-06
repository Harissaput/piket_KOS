'use client';

import React, { useState, useEffect } from 'react';
import { MoreVertical, Check } from 'lucide-react';
import { Member, TaskItem, Task } from '@/types/database';
import { upsertCompletionLog, getLogForDate } from '@/services/completion.service';
import { getTasks } from '@/services/settings.service';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface TodayDutyCardProps {
  member?: Member | null;
  isHoliday?: boolean;
}

export default function TodayDutyCard({ member, isHoliday }: TodayDutyCardProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dateText = format(new Date(), 'EEEE, d MMM yyyy', { locale: idLocale });

  // Load tasks from Database & restore persisted checkbox states
  useEffect(() => {
    async function loadTasksAndState() {
      setLoadingTasks(true);
      try {
        const dbTasks = await getTasks();

        // Check if there is an existing log for today for this member
        let savedCompletedTaskIds: string[] = [];
        let savedStatus = '';
        if (member) {
          const log = await getLogForDate(member.id, todayStr);
          if (log && log.completed_tasks) {
            savedCompletedTaskIds = log.completed_tasks;
            savedStatus = log.status;
          } else {
            // Also check localStorage fallback for seamless offline persistence
            const localKey = `kospiket_tasks_${member.id}_${todayStr}`;
            const stored = localStorage.getItem(localKey);
            if (stored) {
              try {
                savedCompletedTaskIds = JSON.parse(stored);
              } catch {
                savedCompletedTaskIds = [];
              }
            }
          }
          if (savedStatus === 'selesai') {
            setIsSubmitted(true);
          } else {
            setIsSubmitted(false);
          }
        }

        // Map DB tasks
        const mappedTasks: TaskItem[] = dbTasks.map((t) => ({
          id: t.id,
          name: t.name,
          completed: savedCompletedTaskIds.includes(t.id) || savedCompletedTaskIds.includes(t.name),
        }));

        setTasks(mappedTasks);
      } catch (err) {
        console.warn('Error loading duty tasks:', err);
      } finally {
        setLoadingTasks(false);
      }
    }

    loadTasksAndState();
  }, [member, todayStr]);

  const toggleTask = async (id: string) => {
    const updatedTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );
    setTasks(updatedTasks);

    // Save checked states immediately to localStorage & Supabase
    const completedIds = updatedTasks.filter((t) => t.completed).map((t) => t.id);

    if (member) {
      localStorage.setItem(`kospiket_tasks_${member.id}_${todayStr}`, JSON.stringify(completedIds));

      const isAllDone = updatedTasks.length > 0 && updatedTasks.every((t) => t.completed);
      // Don't auto-set to selesai on toggle unless we want it to submit.
      // Wait, we just save progress as 'belum' so they can manually submit later.
      const status = 'belum'; 

      try {
        await upsertCompletionLog(
          member.id,
          todayStr,
          status,
          completedIds,
          'Progress tugas diperbarui'
        );
      } catch (err) {
        console.warn('Persist task error:', err);
      }
    }
  };

  const allCompleted = tasks.length > 0 && tasks.every((t) => t.completed);

  const handleMarkComplete = async () => {
    const allChecked = tasks.map((t) => ({ ...t, completed: true }));
    setTasks(allChecked);

    if (member) {
      setIsSubmitting(true);
      const completedIds = allChecked.map((t) => t.id);
      localStorage.setItem(`kospiket_tasks_${member.id}_${todayStr}`, JSON.stringify(completedIds));

      try {
        await upsertCompletionLog(
          member.id,
          todayStr,
          'selesai',
          completedIds,
          'Selesai mengerjakan dari Dashboard'
        );
        setIsSubmitted(true);
      } catch (err) {
        console.warn('Failed to persist completion log:', err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/80 flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Piket Hari Ini: <span className="font-semibold text-gray-800 capitalize">{dateText}</span>
          </h2>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        {/* Member Avatar & Name */}
        {member ? (
          <div className="flex items-center gap-4 mb-6">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-purple-200 shadow-sm flex-shrink-0 bg-purple-50 p-0.5">
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
            <span className="text-2xl font-bold text-gray-900">{member.name}</span>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl mb-6 text-sm font-semibold text-center">
            {isHoliday ? '🎉 Hari Libur Piket' : '📅 Tidak Ada Jadwal Piket'}
          </div>
        )}

        {/* Tasks Section */}
        {member && (
          <div className="space-y-3 mb-6">
            <h3 className="text-base font-bold text-gray-900 mb-3">Tugas Piket:</h3>
            {loadingTasks ? (
              <div className="space-y-2 text-xs font-semibold text-gray-400">Memuat tugas...</div>
            ) : tasks.length === 0 ? (
              <div className="text-xs text-gray-400 italic">Belum ada daftar tugas.</div>
            ) : isSubmitted ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl flex flex-col items-center gap-3 text-center border border-emerald-100">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-emerald-600 stroke-[3]" />
                </div>
                <div>
                  <p className="font-bold text-sm text-emerald-900">Piket Selesai!</p>
                  <p className="text-xs text-emerald-700 mt-1">Tugas piket pada tanggal ini sudah diselesaikan.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex items-center gap-3 cursor-pointer group select-none"
                  >
                    <div
                      onClick={() => toggleTask(task.id)}
                      className={`w-5 h-5 rounded border transition-colors flex items-center justify-center ${
                        task.completed
                          ? 'bg-gray-800 border-gray-800 text-white'
                          : 'border-gray-300 bg-white group-hover:border-gray-400'
                      }`}
                    >
                      {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span
                      className={`text-sm ${
                        task.completed
                          ? 'text-gray-900 font-medium line-through opacity-80'
                          : 'text-gray-700'
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

      {/* Action Button */}
      {member && !isSubmitted && (
        <button
          onClick={handleMarkComplete}
          disabled={isSubmitting}
          className={`w-full py-3.5 px-6 rounded-full font-bold text-sm shadow-sm transition-all duration-200 ${
            allCompleted
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-[#1e1f23] hover:bg-black text-white'
          }`}
        >
          {isSubmitting ? 'Menyimpan...' : allCompleted ? 'Selesai Mengerjakan' : 'Selesai Mengerjakan'}
        </button>
      )}
    </div>
  );
}
