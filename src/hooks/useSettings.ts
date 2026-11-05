'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings } from '@/types/database';
import { getSettings } from '@/services/settings.service';
import { createClient } from '@/lib/supabase/client';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    id: 'default',
    nama_kost: 'Kos Merdeka',
    start_date: '2026-08-31',
    hari_libur: 'Minggu',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setError(null);
      const data = await getSettings();
      if (data) {
        setSettings(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat pengaturan');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    const supabase = createClient();
    const channel = supabase
      .channel(`settings-realtime-${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  return {
    settings,
    startDate: settings.start_date || '2026-08-31',
    namaKost: settings.nama_kost || 'Kos Merdeka',
    hariLibur: settings.hari_libur || 'Minggu',
    isLoading,
    error,
    refresh: fetchSettings,
  };
}
