import React from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import { SearchProvider } from '@/context/SearchContext';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#e8ecef]">
      <SearchProvider>
        <AdminSidebar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </main>
      </SearchProvider>
    </div>
  );
}
