'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Calendar,
  History,
  ArrowLeftRight,
  BarChart2,
  Shield,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMembers } from '@/hooks/useMembers';
import { useSwapRequests } from '@/hooks/useSwapRequests';

const USER_MENU_ITEMS = [
  { name: 'Dashboard', href: '/', icon: LayoutGrid },
  { name: 'Jadwal Mingguan', href: '/jadwal-mingguan', icon: Calendar },
  { name: 'Riwayat Piket', href: '/riwayat-piket', icon: History },
  { name: 'Tukar Jadwal', href: '/tukar-jadwal', icon: ArrowLeftRight },
  { name: 'Laporan', href: '/laporan', icon: BarChart2 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, profile, member, role, signOut } = useAuth();
  const { members } = useMembers();
  const { pendingRequests } = useSwapRequests();

  const activeCount = members.filter((m) => m.status_aktif).length;
  // Hitung permintaan tukar pending yang ditujukan untuk user ini (atau semua jika admin)
  const incomingPendingCount = pendingRequests.filter(
    (req) => req.status === 'pending' && (role === 'admin' || req.target_member_id === member?.id)
  ).length;

  return (
    <aside className="w-16 sm:w-64 bg-[#141416] text-white flex flex-col h-screen sticky top-0 px-2 sm:px-4 py-6 z-20 transition-all flex-shrink-0">
      {/* Brand Title & Role Badge */}
      <div className="flex flex-col items-center sm:items-start px-2 mb-8">
        <span className="text-sm sm:text-xl font-black tracking-tight text-white truncate">
          KosPiket
        </span>
        <span className="hidden sm:inline-block text-[10px] text-gray-400 font-medium">
          Rotasi Adil Otomatis
        </span>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {USER_MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={`flex items-center justify-center sm:justify-between px-3 sm:px-4 py-3 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${
                    isActive ? 'text-black' : 'text-gray-400'
                  }`}
                />
                <span className="hidden sm:inline truncate">{item.name}</span>
              </div>
              {item.href === '/tukar-jadwal' && incomingPendingCount > 0 && (
                <span className="hidden sm:inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-black rounded-full bg-purple-500 text-white">
                  {incomingPendingCount}
                </span>
              )}
            </Link>
          );
        })}

        {/* Link to Admin Panel for Admin Users */}
        {role === 'admin' && (
          <div className="pt-3 mt-3 border-t border-gray-800/80">
            <Link
              href="/admin"
              className="flex items-center justify-center sm:justify-start gap-3 px-3 sm:px-4 py-2.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/30 transition-all"
              title="Dashboard Admin"
            >
              <Shield className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span className="hidden sm:inline truncate">Dashboard Admin</span>
            </Link>
          </div>
        )}
      </nav>

      {/* User Info & Logout Button */}
      <div className="pt-3 border-t border-gray-800 space-y-3 mt-auto">
        {/* User Card */}
        {user && (
          <div className="hidden sm:flex items-center gap-3 px-2 py-1.5 rounded-2xl bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-purple-500/20 border border-purple-500/40 flex-shrink-0 flex items-center justify-center text-xs font-bold text-purple-300">
              {member?.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {profile?.full_name || member?.name || 'User'}
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                {member ? `Slot: ${member.name}` : user.email}
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Count Footer */}
        <div className="px-2 text-[11px] text-gray-400 hidden sm:block">
          <p className="font-semibold text-gray-300">
            {activeCount > 0 ? `${activeCount} Anggota Aktif` : 'Memuat anggota...'}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">KosPiket v2.2</p>
        </div>

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
