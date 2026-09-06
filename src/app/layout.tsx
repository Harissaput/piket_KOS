import type { Metadata } from 'next';
import Sidebar from '@/components/layout/Sidebar';
import { SearchProvider } from '@/context/SearchContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'KosPiket — Sistem Jadwal Piket Otomatis',
  description: 'Aplikasi jadwal kebersihan kost otomatis berbasis rotasi adil.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="flex min-h-screen bg-[#e8ecef]">
        <SearchProvider>
          <Sidebar />
          <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto">
            {children}
          </main>
        </SearchProvider>
      </body>
    </html>
  );
}
