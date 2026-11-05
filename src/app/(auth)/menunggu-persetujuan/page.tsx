'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Clock, LogOut, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function MenungguPersetujuanPage() {
  const router = useRouter();
  const { user, profile, member, role, status, isLoading, signOut } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login');
      } else if (status === 'approved') {
        router.replace(role === 'admin' ? '/admin' : '/');
      } else if (status === 'rejected') {
        router.replace('/login?error=rejected');
      }
    }
  }, [user, status, role, isLoading, router]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-gray-100 text-center">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs font-bold text-gray-500">Memeriksa status akun Anda...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-gray-100 text-center space-y-6">
      {/* Icon Header */}
      <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border-2 border-amber-100 shadow-sm animate-pulse">
        <Clock className="w-8 h-8 stroke-[2.5]" />
      </div>

      <div className="space-y-2">
        <div className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full mb-1">
          Status: Menunggu Persetujuan
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Akun Anda Sedang Ditinjau
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 max-w-sm mx-auto leading-relaxed">
          Halo <span className="font-bold text-gray-900">{profile?.full_name || user?.email}</span>! Pendaftaran Anda telah kami terima.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left space-y-2.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400 font-semibold">Email:</span>
          <span className="font-bold text-gray-800">{user?.email}</span>
        </div>
        {member && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 font-semibold">Slot Anggota:</span>
            <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
              {member.name}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-200/60">
          <span className="text-gray-400 font-semibold">Waktu Daftar:</span>
          <span className="font-medium text-gray-600">
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('id-ID') : '-'}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-400 italic">
        Halaman ini akan otomatis beralih begitu akun Anda disetujui oleh admin kost.
      </p>

      {/* Logout Button */}
      <div className="pt-2">
        <button
          onClick={() => signOut()}
          className="w-full py-3.5 px-6 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full font-bold text-xs transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4 text-gray-500" />
          <span>Keluar dari Akun</span>
        </button>
      </div>
    </div>
  );
}
