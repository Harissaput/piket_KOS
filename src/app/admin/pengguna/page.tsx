'use client';

import React, { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Profile, Member } from '@/types/database';
import {
  UserCheck,
  Check,
  X,
  Shield,
  ShieldAlert,
  Link as LinkIcon,
  Unlink,
  Search,
  Filter,
  AlertCircle,
  MoreVertical,
} from 'lucide-react';

export default function AdminPenggunaPage() {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('Semua');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [linkingProfileId, setLinkingProfileId] = useState<string | null>(null);
  const [selectedRelinkMemberId, setSelectedRelinkMemberId] = useState<string>('');

  const supabase = createClient();

  const fetchProfilesAndMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      const [profRes, memRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, member:members(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('members')
          .select('*')
          .eq('status_aktif', true)
          .order('order_index', { ascending: true }),
      ]);

      if (profRes.data) {
        setProfiles(profRes.data as Profile[]);
      }
      if (memRes.data) {
        setMembers(memRes.data as Member[]);
      }
    } catch (err) {
      console.error('Error fetching profiles:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProfilesAndMembers();

    const channel = supabase
      .channel('admin-pengguna-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchProfilesAndMembers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProfilesAndMembers, supabase]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // 1. Setujui Akun
  const handleApprove = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'approved',
          approved_by: currentUser?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', profileId);

      if (error) throw error;
      showFeedback('success', 'Akun berhasil disetujui!');
      fetchProfilesAndMembers();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menyetujui akun');
    }
  };

  // 2. Tolak Akun
  const handleReject = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'rejected' })
        .eq('id', profileId);

      if (error) throw error;
      showFeedback('success', 'Akun berhasil ditolak.');
      fetchProfilesAndMembers();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menolak akun');
    }
  };

  // 3. Toggle Role (Jadikan / Cabut Admin)
  const handleToggleAdmin = async (targetProfile: Profile) => {
    const isCurrentlyAdmin = targetProfile.role === 'admin';
    const newRole = isCurrentlyAdmin ? 'user' : 'admin';

    // Cek jika mencabut admin sendiri dan ia satu-satunya admin
    if (isCurrentlyAdmin) {
      const adminCount = profiles.filter(
        (p) => p.role === 'admin' && p.status === 'approved'
      ).length;

      if (adminCount <= 1 && targetProfile.id === currentUser?.id) {
        showFeedback(
          'error',
          'Anda tidak dapat mencabut peran admin diri sendiri karena Anda satu-satunya admin yang tersisa.'
        );
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetProfile.id);

      if (error) throw error;
      showFeedback(
        'success',
        `Peran berhasil diubah menjadi ${newRole === 'admin' ? 'Admin' : 'User'}`
      );
      fetchProfilesAndMembers();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal mengubah peran');
    }
  };

  // 4. Lepas Anggota
  const handleUnlinkMember = async (profileId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ member_id: null })
        .eq('id', profileId);

      if (error) throw error;
      showFeedback('success', 'Tautan slot anggota berhasil dilepas.');
      fetchProfilesAndMembers();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal melepas anggota');
    }
  };

  // 5. Tautkan Ulang Anggota
  const handleRelinkMember = async (profileId: string, memberId: string) => {
    if (!memberId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ member_id: memberId })
        .eq('id', profileId);

      if (error) throw error;
      setLinkingProfileId(null);
      setSelectedRelinkMemberId('');
      showFeedback('success', 'Slot anggota berhasil ditautkan!');
      fetchProfilesAndMembers();
    } catch (err: any) {
      showFeedback('error', err.message || 'Gagal menautkan slot anggota');
    }
  };

  // Filter & Search
  const filteredProfiles = profiles.filter((p) => {
    const matchesStatus =
      filterStatus === 'Semua' || p.status.toLowerCase() === filterStatus.toLowerCase();
    const matchesSearch =
      !search ||
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.member?.name?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate unclaimed members for relinking
  const claimedMemberIds = new Set(
    profiles
      .filter((p) => p.member_id && p.status !== 'rejected')
      .map((p) => p.member_id)
  );
  const unclaimedForRelink = members.filter((m) => !claimedMemberIds.has(m.id));

  return (
    <div className="space-y-6">
      <TopBar title="Kelola Pengguna & Akun" />

      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-bold shadow-sm transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full overflow-x-auto">
            {['Semua', 'Pending', 'Approved', 'Rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  filterStatus === status
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, email, slot..."
              className="pl-9 pr-4 py-2 text-xs font-semibold bg-gray-50 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10 w-full sm:w-64"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Anggota Terhubung</th>
                <th className="py-3 px-4">Peran</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 font-semibold">
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 font-semibold">
                    Tidak ditemukan pengguna yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => {
                  const isSelf = p.id === currentUser?.id;
                  const isPending = p.status === 'pending';
                  const isApproved = p.status === 'approved';
                  const isRejected = p.status === 'rejected';
                  const isAdmin = p.role === 'admin';

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Name & Email */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                            {p.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 flex items-center gap-1.5">
                              {p.full_name}
                              {isSelf && (
                                <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded font-bold">
                                  Anda
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-gray-400">{p.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Member Slot */}
                      <td className="py-4 px-4">
                        {p.member ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-200">
                              <img
                                src={
                                  p.member.avatar_url ||
                                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.member.name}`
                                }
                                alt={p.member.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="font-bold text-gray-800">{p.member.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Belum terhubung</span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <Shield className="w-3 h-3 text-purple-600" /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                            User
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                            <Check className="w-3 h-3 text-emerald-600" /> Disetujui
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Pending
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700">
                            <X className="w-3 h-3 text-rose-600" /> Ditolak
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Approve / Reject buttons for pending */}
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleApprove(p.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-[11px] transition-all flex items-center gap-1 shadow-sm"
                                title="Setujui pendaftaran akun"
                              >
                                <Check className="w-3.5 h-3.5" /> Setujui
                              </button>
                              <button
                                onClick={() => handleReject(p.id)}
                                className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-full font-bold text-[11px] transition-all flex items-center gap-1"
                                title="Tolak pendaftaran akun"
                              >
                                <X className="w-3.5 h-3.5" /> Tolak
                              </button>
                            </>
                          )}

                          {/* Admin Role Toggle */}
                          {isApproved && (
                            <button
                              onClick={() => handleToggleAdmin(p)}
                              className={`px-3 py-1.5 rounded-full font-bold text-[11px] transition-all flex items-center gap-1 ${
                                isAdmin
                                  ? 'bg-gray-100 hover:bg-rose-100 hover:text-rose-700 text-gray-700'
                                  : 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                              }`}
                              title={isAdmin ? 'Cabut hak akses admin' : 'Jadikan admin'}
                            >
                              <Shield className="w-3.5 h-3.5" />
                              {isAdmin ? 'Cabut Admin' : 'Jadikan Admin'}
                            </button>
                          )}

                          {/* Unlink / Relink Member */}
                          {p.member_id ? (
                            <button
                              onClick={() => handleUnlinkMember(p.id)}
                              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-rose-600 transition-colors"
                              title="Lepas tautan anggota"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setLinkingProfileId(p.id);
                                setSelectedRelinkMemberId(unclaimedForRelink[0]?.id || '');
                              }}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-[10px] font-bold flex items-center gap-1"
                              title="Tautkan ke slot anggota"
                            >
                              <LinkIcon className="w-3 h-3" /> Tautkan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Relinking Member */}
      {linkingProfileId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">Tautkan Slot Anggota</h3>
              <button
                onClick={() => setLinkingProfileId(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 font-medium">
              Pilih slot anggota yang belum diklaim untuk akun ini:
            </p>

            {unclaimedForRelink.length === 0 ? (
              <p className="text-xs font-bold text-amber-700 bg-amber-50 p-3 rounded-xl">
                Tidak ada slot anggota yang tersedia saat ini.
              </p>
            ) : (
              <select
                value={selectedRelinkMemberId}
                onChange={(e) => setSelectedRelinkMemberId(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-900"
              >
                {unclaimedForRelink.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Slot #{m.order_index + 1})
                  </option>
                ))}
              </select>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setLinkingProfileId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                disabled={!selectedRelinkMemberId}
                onClick={() => handleRelinkMember(linkingProfileId, selectedRelinkMemberId)}
                className="flex-1 py-2.5 bg-black text-white rounded-full text-xs font-bold hover:bg-gray-800 disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
