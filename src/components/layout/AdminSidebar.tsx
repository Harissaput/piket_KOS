'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Calendar,
  History,
  Settings,
  ArrowLeft,
  LogOut,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const ADMIN_MENU_ITEMS = [
  { name: 'Ringkasan', href: '/admin', icon: LayoutDashboard },
  { name: 'Pengguna', href: '/admin/pengguna', icon: UserCheck },
  { name: 'Anggota Kost', href: '/admin/anggota', icon: Users },
  { name: 'Jadwal & Override', href: '/admin/jadwal', icon: Calendar },
  { name: 'Koreksi Riwayat', href: '/admin/riwayat', icon: History },
  { name: 'Pengaturan Sistem', href: '/admin/pengaturan', icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();

  return (
    <aside className="w-16 sm:w-64 bg-[#141416] text-white flex flex-col h-screen sticky top-0 px-2 sm:px-4 py-6 z-20 transition-all flex-shrink-0">
      {/* Brand & Admin Badge */}
      <div className="flex flex-col items-center sm:items-start px-2 mb-8">
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-xl font-black tracking-tight text-white truncate">
            KosPiket
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Shield className="w-3 h-3 text-purple-400" />
            Admin
          </span>
        </div>
        <span className="hidden sm:inline-block text-[10px] text-gray-400 font-medium mt-0.5">
          Panel Manajemen Admin
        </span>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {ADMIN_MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={`flex items-center justify-center sm:justify-between px-3 sm:px-4 py-3 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${
                    isActive ? 'text-white' : 'text-gray-400'
                  }`}
                />
                <span className="hidden sm:inline truncate">{item.name}</span>
              </div>
            </Link>
          );
        })}

        {/* Back to User View */}
        <div className="pt-3 mt-3 border-t border-gray-800/80">
          <Link
            href="/"
            className="flex items-center justify-center sm:justify-start gap-3 px-3 sm:px-4 py-2.5 rounded-full text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            title="Lihat Tampilan Pengguna"
          >
            <ArrowLeft className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Lihat Tampilan User</span>
          </Link>
        </div>
      </nav>

      {/* Admin User Info & Logout Button */}
      <div className="pt-3 border-t border-gray-800 space-y-3 mt-auto">
        {/* Admin Profile Card */}
        {user && (
          <div className="hidden sm:flex items-center gap-3 px-2 py-1.5 rounded-2xl bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-purple-500/20 border border-purple-500/40 flex-shrink-0 flex items-center justify-center text-xs font-bold text-purple-300">
              {profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {profile?.full_name || 'Admin'}
              </p>
              <p className="text-[10px] text-purple-400 font-medium truncate">
                Super Admin
              </p>
            </div>
          </div>
        )}

        {/* Sign Out Button */}
        <button
          onClick={() => signOut()}
          className="w-full flex items-center justify-center sm:justify-start gap-2.5 px-3 sm:px-4 py-2.5 rounded-full text-xs font-bold text-rose-400 hover:text-white hover:bg-rose-500/20 transition-all"
          title="Keluar dari akun"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </aside>
  );
}
