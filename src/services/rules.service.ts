import { createClient } from '@/lib/supabase/client';
import { KosRule } from '@/types/database';

const LOCAL_STORAGE_RULES_KEY = 'kospiket_rules';

export const DEFAULT_RULES: KosRule[] = [
  { id: 'r1', content: 'Piket wajib selesai sebelum jam 08.00 WIB', sort_order: 1 },
  { id: 'r2', content: 'Sampah dibuang ke tempat sampah utama setiap hari', sort_order: 2 },
  { id: 'r3', content: 'Matikan lampu & alat listrik setelah selesai piket', sort_order: 3 },
];

function getLocalRules(): KosRule[] {
  if (typeof window === 'undefined') return DEFAULT_RULES;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_RULES_KEY);
    if (!stored) {
      localStorage.setItem(LOCAL_STORAGE_RULES_KEY, JSON.stringify(DEFAULT_RULES));
      return DEFAULT_RULES;
    }
    return JSON.parse(stored);
  } catch {
    return DEFAULT_RULES;
  }
}

function saveLocalRules(rules: KosRule[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_RULES_KEY, JSON.stringify(rules));
  } catch {}
}

export async function getRules(): Promise<KosRule[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('kos_rules')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return getLocalRules();
    }

    saveLocalRules(data as KosRule[]);
    return data as KosRule[];
  } catch (err) {
    console.warn('[rules.service] getRules fallback:', err);
    return getLocalRules();
  }
}

export async function addRule(content: string): Promise<KosRule> {
  let created: KosRule;
  const sortOrder = Date.now();

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('kos_rules')
      .insert({
        content,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Gagal membuat peraturan');
    }

    created = data as KosRule;
  } catch (err) {
    console.warn('[rules.service] addRule fallback:', err);
    created = {
      id: `rule-${Date.now()}`,
      content,
      sort_order: sortOrder,
      created_at: new Date().toISOString(),
    };
  }

  const local = getLocalRules();
  saveLocalRules([...local, created]);
  return created;
}

export async function updateRuleContent(id: string, content: string): Promise<KosRule> {
  let updated: KosRule;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('kos_rules')
      .update({ content })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Gagal update peraturan');
    }
    updated = data as KosRule;
  } catch (err) {
    console.warn('[rules.service] updateRuleContent fallback:', err);
    const local = getLocalRules();
    const existing = local.find((r) => r.id === id);
    updated = existing ? { ...existing, content } : { id, content, sort_order: Date.now() };
  }

  const local = getLocalRules();
  saveLocalRules(local.map((r) => (r.id === id ? updated : r)));
  return updated;
}

export async function deleteRule(id: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from('kos_rules').delete().eq('id', id);
  } catch (err) {
    console.warn('[rules.service] deleteRule fallback:', err);
  }

  const local = getLocalRules();
  saveLocalRules(local.filter((r) => r.id !== id));
}
