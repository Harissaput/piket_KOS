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
  Settings
} from 'lucide-react';

const MENU_ITEMS = [
  { name: 'Dashboard', href: '/', icon: LayoutGrid },
  { name: 'Jadwal Mingguan', href: '/jadwal-mingguan', icon: Calendar },
  { name: 'Riwayat Piket', href: '/riwayat-piket', icon: History },
  { name: 'Tukar Jadwal', href: '/tukar-jadwal', icon: ArrowLeftRight },
  { name: 'Laporan', href: '/laporan', icon: BarChart2 },
  { name: 'Pengaturan', href: '/pengaturan', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 sm:w-60 bg-[#141416] text-white flex flex-col h-screen sticky top-0 px-2 sm:px-4 py-6 z-20 transition-all flex-shrink-0">
      {/* Brand Title (Logo Icon Removed as requested) */}
      <div className="flex items-center justify-center sm:justify-start px-2 mb-8">
        <span className="text-sm sm:text-xl font-bold tracking-tight text-white truncate">
          KosPiket
        </span>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-2">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={`flex items-center justify-center sm:justify-between px-3 sm:px-4 py-3 rounded-full text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-white text-black font-semibold shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-black' : 'text-gray-400'}`} />
                <span className="hidden sm:inline truncate">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="px-2 sm:px-4 py-3 text-xs text-gray-500 border-t border-gray-800 mt-auto hidden sm:block">
        <p className="font-medium text-gray-400">KosPiket v2.1</p>
        <p className="text-[11px] mt-0.5">3 Anggota • Rotasi Otomatis</p>
      </div>
    </aside>
  );
}
