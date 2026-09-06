'use client';

import React, { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Settings as SettingsIcon, Save, Users, Calendar, ListTodo, Camera, Plus, Trash2, ScrollText } from 'lucide-react';
import { INITIAL_MEMBERS } from '@/lib/constants/members';
import { useMembers } from '@/hooks/useMembers';
import { useRules } from '@/hooks/useRules';
import { Member, Task, Settings } from '@/types/database';
import {
  getSettings,
  updateSettings,
  getTasks,
  addTask,
  updateTaskName,
  deleteTask,
} from '@/services/settings.service';

const CARTOON_AVATAR_PRESETS = [
  { id: 'p1', label: 'Haris (Tanned)', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Haris&top=shortHair&hairColor=black&facialHair[]=beardLight&skinColor=tanned' },
  { id: 'p2', label: 'Fahrul (Curly)', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fahrul&top=shortCurly&hairColor=brown&skinColor=light' },
  { id: 'p3', label: 'Ishom (Glasses)', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ishom&top=shortFlat&hairColor=black&skinColor=yellow' },
  { id: 'p4', label: 'Boy Glasses', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&top=shortFlat&accessories[]=glasses&accessoriesProbability=100' },
  { id: 'p5', label: 'Blonde Male', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Brian&top=shortRound&hairColor=blonde' },
  { id: 'p6', label: 'Brown Hair', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack&top=shortWaved&hairColor=brown' },
  { id: 'p7', label: 'Beard Style', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dave&top=shortHair&facialHair[]=beardMedium' },
  { id: 'p8', label: 'Cap Style', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sam&top=hat' },
];

export default function PengaturanPage() {
  const { members: dbMembers, handleUpdateAvatar, handleUpdateName } = useMembers();
  const { rules, handleAddRule, handleUpdateRule, handleDeleteRule } = useRules();

  const [settingsRow, setSettingsRow] = useState<Settings | null>(null);
  const [namaKost, setNamaKost] = useState('Kos Merdeka');
  const [startDate, setStartDate] = useState('2026-08-31');
  const [hariLibur, setHariLibur] = useState('Minggu');

  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newRuleContent, setNewRuleContent] = useState('');

  const [activeEditingMemberId, setActiveEditingMemberId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [customUrlError, setCustomUrlError] = useState('');

  // Load Settings & Tasks directly from Database
  useEffect(() => {
    async function loadDbConfig() {
      try {
        setLoadingConfig(true);
        const [st, tk] = await Promise.all([getSettings(), getTasks()]);
        if (st) {
          setSettingsRow(st);
          setNamaKost(st.nama_kost);
          setStartDate(st.start_date);
          setHariLibur(st.hari_libur);
        }
        setTasks(tk);
      } catch (err) {
        console.warn('Error loading settings:', err);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadDbConfig();
  }, []);

  useEffect(() => {
    if (dbMembers && dbMembers.length > 0) {
      setMembers(dbMembers);
    }
  }, [dbMembers]);

  // Save Settings to Database
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settingsRow) {
      try {
        await updateSettings(settingsRow.id, {
          nama_kost: namaKost,
          start_date: startDate,
          hari_libur: hariLibur,
        });
      } catch (err) {
        console.warn('Error updating settings:', err);
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Add Task to Database
  const handleAddTask = async () => {
    if (!newTaskName.trim()) return;
    const taskName = newTaskName.trim();
    setNewTaskName('');

    try {
      const added = await addTask(taskName);
      setTasks((prev) => [...prev, added]);
    } catch (err) {
      console.warn('Error adding task:', err);
    }
  };

  // Edit Task Name in Database
  const handleEditTaskName = async (taskId: string, newName: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, name: newName } : t)));
    try {
      await updateTaskName(taskId, newName);
    } catch (err) {
      console.warn('Error editing task:', err);
    }
  };

  // Delete Task from Database
  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await deleteTask(taskId);
    } catch (err) {
      console.warn('Error deleting task:', err);
    }
  };

  const onUpdateAvatar = async (memberId: string, newAvatarUrl: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, avatar_url: newAvatarUrl } : m))
    );
    setActiveEditingMemberId(null);
    try {
      await handleUpdateAvatar(memberId, newAvatarUrl);
    } catch (err) {
      console.warn('Persist avatar error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <TopBar title="Pengaturan Sistem" />

      <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 text-gray-800 rounded-2xl">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Konfigurasi KosPiket</h2>
              <p className="text-xs text-gray-500 font-medium">
                Atur nama anggota, foto profil kartun, tanggal rotasi, dan daftar tugas
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 bg-black hover:bg-gray-800 text-white rounded-full font-bold text-sm transition-all shadow-sm"
          >
            <Save className="w-4 h-4" /> Simpan Pengaturan
          </button>
        </div>

        {saved && (
          <div className="p-4 bg-emerald-50 text-emerald-800 text-sm font-semibold rounded-2xl">
            ✓ Pengaturan dan Foto Profil berhasil disimpan ke database!
          </div>
        )}

        {/* Section: Edit Profile Photos & Member Names */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" /> Edit Profil & Foto Anggota Kost
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {members.map((member, idx) => (
              <div
                key={member.id}
                className="bg-gray-50 p-5 rounded-3xl border border-gray-200/80 flex flex-col justify-between space-y-4"
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  {/* Profile Avatar with Edit Overlay Button */}
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-purple-50 flex items-center justify-center">
                      <img
                        src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveEditingMemberId(member.id)}
                      className="absolute bottom-0 right-0 p-2 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-transform active:scale-95"
                      title="Ganti Foto Profile Kartun"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <span className="text-[11px] font-extrabold text-purple-700 uppercase tracking-wider bg-purple-100 px-2.5 py-0.5 rounded-full">
                      Anggota #{idx + 1}
                    </span>
                    <h4 className="text-base font-bold text-gray-900 mt-1">{member.name}</h4>
                  </div>
                </div>

                {/* Edit Name & URL Inputs */}
                <div className="space-y-3 pt-2 border-t border-gray-200">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Nama Anggota
                    </label>
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => {
                        const updatedName = e.target.value;
                        setMembers((prev) =>
                          prev.map((m) => (m.id === member.id ? { ...m, name: updatedName } : m))
                        );
                        handleUpdateName(member.id, updatedName).catch(console.warn);
                      }}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-gray-300 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveEditingMemberId(member.id)}
                    className="w-full py-2 px-3 bg-white hover:bg-gray-100 text-gray-800 text-xs font-bold rounded-xl border border-gray-300 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" /> Pilih Kartun Avatar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal / Selector for Cartoon Profile Avatars */}
        {activeEditingMemberId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900">
                  Pilih Foto Profil Kartun (
                  {members.find((m) => m.id === activeEditingMemberId)?.name})
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveEditingMemberId(null)}
                  className="text-gray-400 hover:text-gray-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Preset Gallery */}
              <div className="grid grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                {CARTOON_AVATAR_PRESETS.map((preset) => {
                  const currentMember = members.find((m) => m.id === activeEditingMemberId);
                  const isSelected = currentMember?.avatar_url === preset.url;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onUpdateAvatar(activeEditingMemberId, preset.url)}
                      className={`flex flex-col items-center p-2 rounded-2xl border-2 transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50 scale-105 shadow-sm'
                          : 'border-gray-200 hover:border-gray-400 bg-gray-50'
                      }`}
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden mb-1">
                        <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] font-semibold text-gray-700 truncate w-full text-center">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom URL Option */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-700">Atau Gunakan Custom Image URL:</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    id="customUrlInput"
                    onChange={() => setCustomUrlError('')}
                    className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-300 text-xs font-semibold text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('customUrlInput') as HTMLInputElement;
                      const url = input?.value?.trim() || '';
                      setCustomUrlError('');

                      // Validate URL format
                      if (!url) {
                        setCustomUrlError('URL tidak boleh kosong.');
                        return;
                      }
                      let parsed: URL;
                      try {
                        parsed = new URL(url);
                      } catch {
                        setCustomUrlError('Format URL tidak valid. Gunakan format https://...');
                        return;
                      }
                      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                        setCustomUrlError('Hanya URL dengan http atau https yang diizinkan.');
                        return;
                      }
                      // Whitelist allowed image domains
                      const ALLOWED_DOMAINS = [
                        'api.dicebear.com',
                        'i.imgur.com',
                        'imgur.com',
                        'lh3.googleusercontent.com',
                        'avatars.githubusercontent.com',
                        'cdn.discordapp.com',
                        'pbs.twimg.com',
                        'ui-avatars.com',
                      ];
                      const isAllowed = ALLOWED_DOMAINS.some(
                        (domain) => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
                      );
                      if (!isAllowed) {
                        setCustomUrlError('Domain tidak diizinkan. Gunakan imgur, dicebear, googleusercontent, atau domain gambar umum lainnya.');
                        return;
                      }
                      onUpdateAvatar(activeEditingMemberId, url);
                    }}
                    className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-gray-800"
                  >
                    Terapkan
                  </button>
                </div>
                {customUrlError && (
                  <p className="text-xs font-semibold text-rose-600 mt-1">{customUrlError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* General Config & Tasks CRUD */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
          {/* Informasi Kost & Siklus */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" /> Informasi Kost & Siklus
            </h3>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Nama Kost</label>
              <input
                type="text"
                value={namaKost}
                onChange={(e) => setNamaKost(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Tanggal Mulai Siklus (startDate)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Hari Libur Piket</label>
              <select
                value={hariLibur}
                onChange={(e) => setHariLibur(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-900"
              >
                {['Minggu', 'Sabtu', 'Jumat'].map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Daftar Tugas Piket Standard (Full CRUD: Add, Edit, Delete) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-emerald-600" /> Daftar Tugas Piket Standard
            </h3>

            {/* Form Tambah Tugas Baru */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Tambah tugas piket baru..."
                className="flex-1 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900"
              />
              <button
                type="button"
                onClick={handleAddTask}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>

            {/* List Tugas dengan fitur Edit & Delete */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={task.name}
                    onChange={(e) => handleEditTaskName(task.id, e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold text-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Hapus tugas"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Papan Peraturan Kost (Full CRUD: Add, Edit, Delete) */}
        <div className="pt-6 border-t border-gray-100 space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-purple-600" /> Papan Peraturan Kost
          </h3>

          {/* Form Tambah Peraturan Baru */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newRuleContent}
              onChange={(e) => setNewRuleContent(e.target.value)}
              placeholder="Tambah peraturan kos baru..."
              className="flex-1 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900"
            />
            <button
              type="button"
              onClick={async () => {
                if (!newRuleContent.trim()) return;
                const text = newRuleContent.trim();
                setNewRuleContent('');
                await handleAddRule(text);
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah
            </button>
          </div>

          {/* List Peraturan dengan fitur Edit & Delete */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={rule.content}
                  onChange={(e) => handleUpdateRule(rule.id, e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-semibold text-gray-800"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.id)}
                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                  title="Hapus peraturan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
