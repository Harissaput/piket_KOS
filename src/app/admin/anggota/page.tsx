'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { useMembers } from '@/hooks/useMembers';
import { Member } from '@/types/database';
import {
  addMemberRpc,
  deactivateMemberRpc,
  reactivateMemberRpc,
  deleteMemberIfUnused,
  updateMemberName,
  updateMemberAvatar,
} from '@/services/member.service';
import { getDutyMemberForDateWithEpochs } from '@/lib/algorithms/scheduleRotation';
import { formatLocalDate } from '@/lib/utils/date';
import { addDays, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import {
  UserPlus,
  Power,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  Palette,
  Camera,
} from 'lucide-react';

const AVATAR_PALETTE = [
  '#a855f7', // Purple
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Indigo
];

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
  const { members, isLoading, refetch } = useMembers(true); // Muat aktif & nonaktif
  const [profileMap, setProfileMap] = useState<Map<string, { email: string; full_name: string }>>(new Map());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit State
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Modal Tambah Anggota
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(AVATAR_PALETTE[0]);
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [newEffectiveFrom, setNewEffectiveFrom] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Modal Deactivate / Reactivate
  const [confirmModal, setConfirmModal] = useState<{
    member: Member;
    action: 'deactivate' | 'reactivate' | 'delete';
    effectiveFrom: string;
  } | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Modal Avatar Picker
  const [avatarModalMemberId, setAvatarModalMemberId] = useState<string | null>(null);

  const supabase = createClient();

  // Hitung default Senin berikutnya
  const nextMondayStr = useMemo(() => {
    const today = new Date();
    const dow = today.getDay(); // 0 Sun, 1 Mon ...
    const daysUntilNextMonday = ((8 - dow) % 7) || 7;
    const nextMon = addDays(today, daysUntilNextMonday);
    return formatLocalDate(nextMon);
  }, []);

  // Fetch claimed profiles for each member
  const loadProfiles = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('member_id, email, full_name')
        .not('member_id', 'is', null);

      if (data) {
        const map = new Map<string, { email: string; full_name: string }>();
        data.forEach((p) => {
          if (p.member_id) {
            map.set(p.member_id, { email: p.email, full_name: p.full_name });
          }
        });
        setProfileMap(map);
      }
    } catch (err) {
      console.warn('Gagal memuat profil anggota:', err);
    }
  }, [supabase]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (members.length > 0) {
      const initialMap: Record<string, string> = {};
      members.forEach((m) => {
        initialMap[m.id] = m.name;
      });
      setEditingNames(initialMap);
    }
  }, [members]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleOpenAddModal = () => {
    setNewName('');
    setNewColor(AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)]);
    setNewAvatarUrl('');
    setNewEffectiveFrom(nextMondayStr);
    setShowAddModal(true);
  };

  // Pratinjau dampak penambahan anggota (2 minggu setelah tanggal efektif)
  const previewImpactSchedule = useMemo(() => {
    if (!newName.trim() || !newEffectiveFrom) return [];

    const activeList = members.filter((m) => m.status_aktif);
    const mockNewMember: Member = {
      id: 'mock-new-member',
      name: newName.trim(),
      order_index: members.length,
      avatar_color: newColor,
      status_aktif: true,
      joined_at: new Date().toISOString(),
    };

    const simulatedMembers = [...activeList, mockNewMember];
    const simulatedEpochs = [
      {
        id: 'sim-epoch',
        effective_from: newEffectiveFrom,
        member_order: simulatedMembers.map((m) => m.id),
        created_at: new Date().toISOString(),
      },
    ];

    const startDate = new Date(newEffectiveFrom + 'T00:00:00');
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(startDate, i);
      const duty = getDutyMemberForDateWithEpochs(d, simulatedMembers, simulatedEpochs, newEffectiveFrom);
      days.push({
        dateStr: formatLocalDate(d),
        dateFormatted: format(d, 'EEEE, d MMM', { locale: localeId }),
        isLibur: d.getDay() === 0,
        member: duty,
      });
    }
    return days;
  }, [newName, newEffectiveFrom, newColor, members]);

  const handleSaveAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showFeedback('error', 'Nama anggota wajib diisi.');
      return;
    }
    if (newName.trim().length > 40) {
      showFeedback('error', 'Nama anggota maksimal 40 karakter.');
      return;
    }
    if (!newEffectiveFrom) {
      showFeedback('error', 'Tanggal mulai berlaku wajib dipilih.');
      return;
    }

    setIsAdding(true);
    try {
      await addMemberRpc({
        name: newName.trim(),
        avatarColor: newColor,
        avatarUrl: newAvatarUrl.trim() || null,
        effectiveFrom: newEffectiveFrom,
      });

      showFeedback('success', `Anggota "${newName.trim()}" berhasil ditambahkan dan mulai berlaku ${newEffectiveFrom}!`);
      setShowAddModal(false);
      await refetch();
      await loadProfiles();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menambahkan anggota.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveEdit = async (member: Member) => {
    const updatedName = editingNames[member.id]?.trim();
    if (!updatedName) {
      showFeedback('error', 'Nama anggota tidak boleh kosong.');
      return;
    }

    setSavingId(member.id);
    try {
      await updateMemberName(member.id, updatedName);
      showFeedback('success', `Nama anggota berhasil diubah menjadi "${updatedName}"!`);
      await refetch();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menyimpan perubahan.');
    } finally {
      setSavingId(null);
    }
  };

  const handleExecuteStatusOrDelete = async () => {
    if (!confirmModal) return;
    const { member, action, effectiveFrom } = confirmModal;

    setIsProcessingAction(true);
    try {
      if (action === 'deactivate') {
        const activeCount = members.filter((m) => m.status_aktif).length;
        if (activeCount <= 2) {
          throw new Error('Tidak dapat menonaktifkan. Rotasi membutuhkan minimal 2 anggota aktif.');
        }
        await deactivateMemberRpc(member.id, effectiveFrom);
        showFeedback('success', `Anggota ${member.name} dinonaktifkan mulai ${effectiveFrom}.`);
      } else if (action === 'reactivate') {
        await reactivateMemberRpc(member.id, effectiveFrom);
        showFeedback('success', `Anggota ${member.name} diaktifkan kembali mulai ${effectiveFrom}.`);
      } else if (action === 'delete') {
        await deleteMemberIfUnused(member.id);
        showFeedback('success', `Anggota ${member.name} berhasil dihapus permanen.`);
      }

      setConfirmModal(null);
      await refetch();
      await loadProfiles();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal memproses aksi.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSelectAvatarPreset = async (memberId: string, url: string) => {
    try {
      await updateMemberAvatar(memberId, url);
      showFeedback('success', 'Avatar berhasil diperbarui!');
      setAvatarModalMemberId(null);
      await refetch();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal mengganti avatar');
    }
  };

  const activeMembersCount = members.filter((m) => m.status_aktif).length;

  return (
    <div className="space-y-6">
      <TopBar title="Manajemen Anggota Kost" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Slot Anggota Piket</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Total {members.length} slot terdaftar ({activeMembersCount} aktif dalam rotasi jadwal)
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[#141416] hover:bg-black text-white text-xs font-bold rounded-full shadow-md transition-all duration-200"
        >
          <UserPlus className="w-4 h-4 text-purple-400" />
          <span>Tambah Anggota / Slot</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-start gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Members Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs font-bold text-gray-400 bg-white rounded-3xl border border-gray-100">
          Memuat daftar slot anggota...
        </div>
      ) : members.length === 0 ? (
        <div className="p-12 text-center text-xs font-bold text-gray-400 bg-white rounded-3xl border border-gray-100">
          Belum ada anggota terdaftar. Klik tombol Tambah Anggota untuk mulai.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {members.map((member) => {
            const isSavingThis = savingId === member.id;
            const claimedProfile = profileMap.get(member.id);
            const isNameModified = (editingNames[member.id] || '').trim() !== member.name;

            return (
              <div
                key={member.id}
                className={`bg-white rounded-3xl p-6 shadow-sm border transition-all flex flex-col justify-between ${
                  member.status_aktif ? 'border-gray-100' : 'border-gray-200 bg-gray-50/70 opacity-80'
                }`}
              >
                <div>
                  {/* Top Status & Order Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                      Slot #{member.order_index + 1}
                    </span>

                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        member.status_aktif
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {member.status_aktif ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  {/* Avatar & Camera Edit */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative group">
                      <div
                        className="w-16 h-16 rounded-full overflow-hidden border-2 shadow-sm flex items-center justify-center text-xl font-bold"
                        style={{
                          borderColor: member.avatar_color || '#a855f7',
                          backgroundColor: `${member.avatar_color || '#a855f7'}20`,
                          color: member.avatar_color || '#a855f7',
                        }}
                      >
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          member.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <button
                        onClick={() => setAvatarModalMemberId(member.id)}
                        className="absolute bottom-0 right-0 p-1.5 rounded-full bg-gray-900 text-white shadow-md hover:bg-black transition-all"
                        title="Ubah Avatar"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                        Nama Anggota
                      </label>
                      <input
                        type="text"
                        value={editingNames[member.id] ?? member.name}
                        onChange={(e) =>
                          setEditingNames((prev) => ({ ...prev, [member.id]: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:bg-white focus:border-black transition-all"
                      />
                    </div>
                  </div>

                  {/* Account Link Badge */}
                  <div className="mb-4 p-2.5 rounded-2xl bg-gray-50 border border-gray-100 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                      Status Akun Login:
                    </span>
                    {claimedProfile ? (
                      <p className="font-bold text-gray-900 truncate" title={claimedProfile.email}>
                        Terhubung: <span className="text-purple-600 font-semibold">{claimedProfile.email}</span>
                      </p>
                    ) : (
                      <p className="font-bold text-amber-700">
                        Belum ada akun (Tersedia di form /daftar)
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {/* Save Edit Name Button */}
                  {isNameModified && (
                    <button
                      onClick={() => handleSaveEdit(member)}
                      disabled={isSavingThis}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-full transition-all shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingThis ? 'Menyimpan...' : 'Simpan Nama'}</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    {/* Toggle Active / Inactive */}
                    <button
                      onClick={() =>
                        setConfirmModal({
                          member,
                          action: member.status_aktif ? 'deactivate' : 'reactivate',
                          effectiveFrom: nextMondayStr,
                        })
                      }
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition-all ${
                        member.status_aktif
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{member.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}</span>
                    </button>

                    {/* Delete Permanen jika belum dipakai */}
                    <button
                      onClick={() =>
                        setConfirmModal({
                          member,
                          action: 'delete',
                          effectiveFrom: nextMondayStr,
                        })
                      }
                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
                      title="Hapus Permanen (hanya jika belum ada riwayat)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL TAMBAH ANGGOTA / SLOT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6 my-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">Tambah Anggota / Slot Baru</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Slot otomatis tersedia untuk diklaim pengguna baru di halaman pendaftaran.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Nama Anggota (Wajib)
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Rian Pratama"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none focus:bg-white focus:border-black transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-gray-500" />
                  <span>Warna Avatar</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {AVATAR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        newColor === color ? 'ring-2 ring-offset-2 ring-black scale-110' : 'opacity-80'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  URL Avatar (Opsional)
                </label>
                <input
                  type="url"
                  value={newAvatarUrl}
                  onChange={(e) => setNewAvatarUrl(e.target.value)}
                  placeholder="https://api.dicebear.com/..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold text-gray-900 focus:outline-none focus:bg-white focus:border-black transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  <span>Tanggal Mulai Berlaku (Jadwal Masa Lalu Tetap Aman)</span>
                </label>
                <input
                  type="date"
                  required
                  min={formatLocalDate(new Date())}
                  value={newEffectiveFrom}
                  onChange={(e) => setNewEffectiveFrom(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-semibold text-gray-900 focus:outline-none focus:bg-white focus:border-black transition-all"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Default: Senin berikutnya ({nextMondayStr}). Jadwal sebelum tanggal ini tidak akan berubah.
                </p>
              </div>

              {/* Pratinjau Dampak 2 Minggu */}
              {previewImpactSchedule.length > 0 && (
                <div className="p-4 bg-purple-50/70 border border-purple-100 rounded-2xl space-y-2">
                  <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider block">
                    Pratinjau Rotasi Jadwal Baru (2 Minggu Pertama):
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {previewImpactSchedule.map((p, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                          p.isLibur ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-900 shadow-xs'
                        }`}
                      >
                        <span className="font-semibold">{p.dateFormatted}</span>
                        <span className="font-bold truncate">
                          {p.isLibur ? 'Libur' : p.member?.name || '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-6 py-2.5 rounded-full text-xs font-bold bg-[#141416] hover:bg-black text-white transition-all shadow-md disabled:opacity-50"
                >
                  {isAdding ? 'Menyimpan...' : 'Simpan Anggota Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI (DEACTIVATE / REACTIVATE / DELETE) */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5">
            <h3 className="text-lg font-bold text-gray-900">
              {confirmModal.action === 'deactivate'
                ? `Nonaktifkan ${confirmModal.member.name}?`
                : confirmModal.action === 'reactivate'
                ? `Aktifkan Kembali ${confirmModal.member.name}?`
                : `Hapus Permanen ${confirmModal.member.name}?`}
            </h3>

            <p className="text-xs text-gray-600 leading-relaxed">
              {confirmModal.action === 'deactivate'
                ? 'Anggota ini akan dikeluarkan dari rotasi jadwal mulai tanggal efektif di bawah. Riwayat piket masa lalu tetap tersimpan utuh.'
                : confirmModal.action === 'reactivate'
                ? 'Anggota ini akan kembali dimasukkan ke dalam rotasi jadwal mulai tanggal efektif di bawah.'
                : 'Penghapusan permanen hanya akan berhasil jika anggota belum pernah memiliki riwayat piket, izin, atau tukar jadwal.'}
            </p>

            {confirmModal.action !== 'delete' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Mulai Berlaku Pada:
                </label>
                <input
                  type="date"
                  min={formatLocalDate(new Date())}
                  value={confirmModal.effectiveFrom}
                  onChange={(e) =>
                    setConfirmModal((prev) => (prev ? { ...prev, effectiveFrom: e.target.value } : null))
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:bg-white"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-full transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleExecuteStatusOrDelete}
                className={`px-5 py-2 text-xs font-bold rounded-full text-white transition-all shadow-md ${
                  confirmModal.action === 'deactivate' || confirmModal.action === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isProcessingAction ? 'Memproses...' : 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRESET AVATAR */}
      {avatarModalMemberId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Pilih Avatar Kartun</h3>
              <button
                onClick={() => setAvatarModalMemberId(null)}
                className="p-1.5 text-gray-400 hover:text-gray-900 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
              {CARTOON_AVATAR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectAvatarPreset(avatarModalMemberId, p.url)}
                  className="flex flex-col items-center gap-1 p-2 rounded-2xl hover:bg-purple-50 hover:border-purple-300 border border-transparent transition-all"
                >
                  <img src={p.url} alt={p.label} className="w-12 h-12 rounded-full object-cover" />
                  <span className="text-[10px] font-bold text-gray-600 truncate w-full text-center">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
