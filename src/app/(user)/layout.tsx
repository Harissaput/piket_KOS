import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { SearchProvider } from '@/context/SearchContext';

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#e8ecef]">
      <SearchProvider>
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </main>
      </SearchProvider>
    </div>
  );
}
