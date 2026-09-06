'use client';

import { useState, useEffect, useCallback } from 'react';
import { KosRule } from '@/types/database';
import {
  getRules,
  addRule,
  updateRuleContent,
  deleteRule,
} from '@/services/rules.service';
import { createClient } from '@/lib/supabase/client';

export function useRules() {
  const [rules, setRules] = useState<KosRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      setError(null);
      const data = await getRules();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat peraturan');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();

    const supabase = createClient();
    const channel = supabase
      .channel(`kos_rules-realtime-${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kos_rules' },
        () => fetchRules()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRules]);

  const handleAddRule = async (content: string) => {
    try {
      const created = await addRule(content);
      setRules((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menambah peraturan');
      throw err;
    }
  };

  const handleUpdateRule = async (id: string, content: string) => {
    try {
      const updated = await updateRuleContent(id, content);
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memutakhirkan peraturan');
      throw err;
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus peraturan');
      throw err;
    }
  };

  return {
    rules,
    isLoading,
    error,
    refetch: fetchRules,
    handleAddRule,
    handleUpdateRule,
    handleDeleteRule,
  };
}
