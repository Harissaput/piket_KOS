'use client';

import React, { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import {
  Settings as SettingsIcon,
  Save,
  Calendar,
  ListTodo,
  Plus,
  Trash2,
  ScrollText,
  Check,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useRules } from '@/hooks/useRules';
import { Task, Settings } from '@/types/database';
import {
  updateSettings,
  getTasks,
  addTask,
  updateTaskName,
  deleteTask,
} from '@/services/settings.service';

export default function AdminPengaturanPage() {
  const { settings: initialSettings, refresh: refreshSettings } = useSettings();
  const { rules, handleAddRule, handleUpdateRule, handleDeleteRule } = useRules();

  const [namaKost, setNamaKost] = useState('');
  const [startDate, setStartDate] = useState('');
  const [hariLibur, setHariLibur] = useState('Minggu');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newRuleContent, setNewRuleContent] = useState('');

  // Explicit editing buffer for tasks & rules so we don't spam DB on every keystroke
  const [taskEdits, setTaskEdits] = useState<{ [id: string]: string }>({});
  const [ruleEdits, setRuleEdits] = useState<{ [id: string]: string }>({});

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (initialSettings) {
      setNamaKost(initialSettings.nama_kost);
      setStartDate(initialSettings.start_date);
      setHariLibur(initialSettings.hari_libur);
    }
  }, [initialSettings]);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const data = await getTasks();
        setTasks(data);
      } catch (err) {
        console.warn('Error fetching tasks:', err);
      }
    }
    fetchTasks();
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  // 1. Simpan Pengaturan Umum
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialSettings?.id) return;

    setIsSavingSettings(true);
    try {
      await updateSettings(initialSettings.id, {
        nama_kost: namaKost.trim(),
        start_date: startDate,
        hari_libur: hariLibur,
      });
      await refreshSettings();
      showFeedback('success', 'Pengaturan kost berhasil disimpan ke database!');
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 2. Tambah Tugas
  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    try {
      const added = await addTask(newTaskName.trim());
      setTasks((prev) => [...prev, added]);
      setNewTaskName('');
      showFeedback('success', 'Tugas baru berhasil ditambahkan.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menambahkan tugas.');
    }
  };

  // 3. Simpan Perubahan Nama Tugas
  const handleSaveTaskName = async (taskId: string) => {
    const newName = taskEdits[taskId]?.trim();
    if (!newName) return;

    try {
      await updateTaskName(taskId, newName);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, name: newName } : t)));
      setTaskEdits((prev) => {
        const copy = { ...prev };
        delete copy[taskId];
        return copy;
      });
      showFeedback('success', 'Nama tugas berhasil diperbarui.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal mengubah nama tugas.');
    }
  };

  // 4. Hapus Tugas
  const handleDeleteTaskAction = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      showFeedback('success', 'Tugas berhasil dihapus.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menghapus tugas.');
    }
  };

  // 5. Tambah Peraturan
  const handleAddRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleContent.trim()) return;

    try {
      await handleAddRule(newRuleContent.trim());
      setNewRuleContent('');
      showFeedback('success', 'Peraturan baru berhasil ditambahkan.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menambahkan peraturan.');
    }
  };

  // 6. Simpan Perubahan Peraturan
  const handleSaveRuleContent = async (ruleId: string) => {
    const newContent = ruleEdits[ruleId]?.trim();
    if (!newContent) return;

    try {
      await handleUpdateRule(ruleId, newContent);
      setRuleEdits((prev) => {
        const copy = { ...prev };
        delete copy[ruleId];
        return copy;
      });
      showFeedback('success', 'Peraturan berhasil diperbarui.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal memperbarui peraturan.');
    }
  };

  return (
    <div className="space-y-6">
      <TopBar title="Pengaturan Sistem" />

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

      {/* Main Settings Card */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Konfigurasi KosPiket</h2>
              <p className="text-xs text-gray-500 font-medium">
                Atur nama kost, tanggal awal siklus rotasi, dan hari libur
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingSettings}
            className="flex items-center gap-2 px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-full font-bold text-xs sm:text-sm transition-all shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Nama Kost
            </label>
            <input
              type="text"
              required
              value={namaKost}
              onChange={(e) => setNamaKost(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Tanggal Mulai Siklus (startDate)
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Hari Libur Piket
            </label>
            <select
              value={hariLibur}
              onChange={(e) => setHariLibur(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
            >
              <option value="Minggu">Minggu</option>
              <option value="Sabtu">Sabtu</option>
              <option value="Jumat">Jumat</option>
            </select>
          </div>
        </div>
      </form>

      {/* Grid: Tasks & Rules CRUD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tasks Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <ListTodo className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Daftar Tugas Piket</h3>
              <p className="text-xs text-gray-500 font-medium">Tugas harian yang harus dikerjakan</p>
            </div>
          </div>

          {/* Form Add Task */}
          <form onSubmit={handleAddTaskSubmit} className="flex gap-2">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Tambah tugas piket baru..."
              className="flex-1 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </form>

          {/* List Tasks */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {tasks.map((task) => {
              const currentVal = taskEdits[task.id] !== undefined ? taskEdits[task.id] : task.name;
              const isModified = taskEdits[task.id] !== undefined && taskEdits[task.id] !== task.name;

              return (
                <div key={task.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={currentVal}
                    onChange={(e) =>
                      setTaskEdits((prev) => ({ ...prev, [task.id]: e.target.value }))
                    }
                    className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold text-gray-800 focus:bg-white"
                  />
                  {isModified && (
                    <button
                      type="button"
                      onClick={() => handleSaveTaskName(task.id)}
                      className="px-2.5 py-1.5 bg-black text-white text-[11px] font-bold rounded-xl hover:bg-gray-800"
                      title="Simpan perubahan nama tugas"
                    >
                      Simpan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteTaskAction(task.id)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Hapus tugas"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rules Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Papan Peraturan Kost</h3>
              <p className="text-xs text-gray-500 font-medium">Tata tertib yang ditampilkan di dashboard</p>
            </div>
          </div>

          {/* Form Add Rule */}
          <form onSubmit={handleAddRuleSubmit} className="flex gap-2">
            <input
              type="text"
              value={newRuleContent}
              onChange={(e) => setNewRuleContent(e.target.value)}
              placeholder="Tambah peraturan kost..."
              className="flex-1 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </form>

          {/* List Rules */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {rules.map((rule) => {
              const currentVal = ruleEdits[rule.id] !== undefined ? ruleEdits[rule.id] : rule.content;
              const isModified = ruleEdits[rule.id] !== undefined && ruleEdits[rule.id] !== rule.content;

              return (
                <div key={rule.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={currentVal}
                    onChange={(e) =>
                      setRuleEdits((prev) => ({ ...prev, [rule.id]: e.target.value }))
                    }
                    className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold text-gray-800 focus:bg-white"
                  />
                  {isModified && (
                    <button
                      type="button"
                      onClick={() => handleSaveRuleContent(rule.id)}
                      className="px-2.5 py-1.5 bg-black text-white text-[11px] font-bold rounded-xl hover:bg-gray-800"
                      title="Simpan peraturan"
                    >
                      Simpan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Hapus peraturan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
