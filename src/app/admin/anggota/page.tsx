'use client';

import React, { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { useMembers } from '@/hooks/useMembers';
import { Member } from '@/types/database';
import {
  Users,
  Camera,
  Check,
  AlertCircle,
  Save,
  Power,
  Sparkles,
} from 'lucide-react';

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

export default function AdminAnggotaPage() {
  const { members: initialMembers, isLoading } = useMembers();
  const [members, setMembers] = useState<Member[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [activeAvatarModalMemberId, setActiveAvatarModalMemberId] = useState<string | null>(null);
  const [customUrlError, setCustomUrlError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (initialMembers.length > 0) {
      setMembers(initialMembers);
    }
  }, [initialMembers]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleNameChange = (memberId: string, newName: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, name: newName } : m))
    );
  };

  const handleSaveMember = async (member: Member) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('members')
        .update({
          name: member.name.trim(),
          avatar_url: member.avatar_url,
          status_aktif: member.status_aktif,
        })
        .eq('id', member.id);

      if (error) throw error;
      showFeedback('success', `Data anggota ${member.name} berhasil disimpan!`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menyimpan data anggota');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (member: Member) => {
    const updatedStatus = !member.status_aktif;
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, status_aktif: updatedStatus } : m))
    );

    try {
      const { error } = await supabase
        .from('members')
        .update({ status_aktif: updatedStatus })
        .eq('id', member.id);

      if (error) throw error;
      showFeedback(
        'success',
        `Status ${member.name} diubah menjadi ${updatedStatus ? 'Aktif' : 'Nonaktif'}`
      );
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal mengubah status aktif');
    }
  };

  const handleSelectAvatarPreset = async (memberId: string, url: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, avatar_url: url } : m))
    );
    setActiveAvatarModalMemberId(null);

    try {
      const { error } = await supabase
        .from('members')
        .update({ avatar_url: url })
        .eq('id', memberId);

      if (error) throw error;
      showFeedback('success', 'Foto profil kartun berhasil diperbarui!');
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal memperbarui avatar');
    }
  };

  return (
    <div className="space-y-6">
      <TopBar title="Kelola Anggota Kost" />

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
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Daftar Anggota Kost</h2>
              <p className="text-xs text-gray-500 font-medium">
                Atur nama anggota, avatar kartun, dan status aktif untuk rotasi piket
              </p>
            </div>
          </div>
        </div>

        {/* Member Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-3 py-12 text-center text-gray-400 font-semibold text-xs">
              Memuat data anggota...
            </div>
          ) : (
            members.map((member, idx) => (
              <div
                key={member.id}
                className={`p-6 rounded-3xl border transition-all flex flex-col justify-between space-y-5 ${
                  member.status_aktif
                    ? 'bg-gray-50/80 border-gray-200/80 shadow-sm'
                    : 'bg-gray-100/50 border-dashed border-gray-300 opacity-75'
                }`}
              >
                {/* Header with Slot Badge & Status Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-purple-700 bg-purple-100 px-3 py-0.5 rounded-full uppercase tracking-wider">
                    Slot #{idx + 1} (Order {member.order_index})
                  </span>
                  <button
                    onClick={() => handleToggleStatus(member)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                      member.status_aktif
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                    title={member.status_aktif ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                  >
                    <Power className="w-3 h-3" />
                    <span>{member.status_aktif ? 'Aktif' : 'Nonaktif'}</span>
                  </button>
                </div>

                {/* Avatar with Overlay Button */}
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-purple-50 flex items-center justify-center">
                      <img
                        src={
                          member.avatar_url ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`
                        }
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveAvatarModalMemberId(member.id)}
                      className="absolute bottom-0 right-0 p-2 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-transform active:scale-95"
                      title="Ganti Foto Profil Kartun"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Edit Form */}
                <div className="space-y-3 pt-2 border-t border-gray-200">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      Nama Anggota
                    </label>
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => handleNameChange(member.id, e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-gray-300 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveAvatarModalMemberId(member.id)}
                      className="flex-1 py-2 px-3 bg-white hover:bg-gray-100 text-gray-800 text-xs font-bold rounded-xl border border-gray-300 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" /> Pilih Kartun
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveMember(member)}
                      disabled={isSaving}
                      className="py-2 px-4 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" /> Simpan
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal for Cartoon Avatar Selection */}
      {activeAvatarModalMemberId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                Pilih Foto Profil Kartun (
                {members.find((m) => m.id === activeAvatarModalMemberId)?.name})
              </h3>
              <button
                type="button"
                onClick={() => setActiveAvatarModalMemberId(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
              {CARTOON_AVATAR_PRESETS.map((preset) => {
                const currentMember = members.find((m) => m.id === activeAvatarModalMemberId);
                const isSelected = currentMember?.avatar_url === preset.url;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectAvatarPreset(activeAvatarModalMemberId, preset.url)}
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

            {/* Custom URL */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="block text-xs font-bold text-gray-700">Atau Gunakan Custom Image URL:</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://..."
                  id="customAvatarUrlInput"
                  onChange={() => setCustomUrlError('')}
                  className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-300 text-xs font-semibold text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('customAvatarUrlInput') as HTMLInputElement;
                    const url = input?.value?.trim() || '';
                    if (!url) {
                      setCustomUrlError('URL tidak boleh kosong');
                      return;
                    }
                    handleSelectAvatarPreset(activeAvatarModalMemberId, url);
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
    </div>
  );
}
