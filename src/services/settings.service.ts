import { createClient } from '@/lib/supabase/client';
import { Settings, Task } from '@/types/database';

export const DEFAULT_SETTINGS: Settings = {
  id: 'set-default',
  nama_kost: 'Kos Merdeka',
  start_date: '2026-08-31',
  hari_libur: 'Minggu',
};

export const DEFAULT_TASKS: Task[] = [
  { id: 't1', name: 'Sapu & Pel Ruang Bersama', is_active: true, sort_order: 1 },
  { id: 't2', name: 'Buang Sampah', is_active: true, sort_order: 2 },
  { id: 't3', name: 'Bersihkan Kamar Mandi Umum', applies_to_day: 'Sabtu', is_active: true, sort_order: 3 },
];

/**
 * Fetch the single settings row for this kost.
 */
export async function getSettings(): Promise<Settings> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.warn('[settings.service] getSettings fallback:', error?.message);
      return DEFAULT_SETTINGS;
    }

    return data as Settings;
  } catch (err) {
    console.warn('[settings.service] getSettings fallback error:', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Persist updated settings (nama_kost, start_date, hari_libur).
 */
export async function updateSettings(
  settingsId: string,
  payload: Partial<Omit<Settings, 'id'>>
): Promise<Settings> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('settings')
      .update(payload)
      .eq('id', settingsId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Gagal update settings');
    }

    return data as Settings;
  } catch (err) {
    console.warn('[settings.service] updateSettings fallback:', err);
    return { ...DEFAULT_SETTINGS, ...payload, id: settingsId };
  }
}

/**
 * Fetch all active tasks ordered by sort_order.
 */
export async function getTasks(): Promise<Task[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      console.warn('[settings.service] getTasks fallback:', error?.message);
      return DEFAULT_TASKS;
    }

    return data as Task[];
  } catch (err) {
    console.warn('[settings.service] getTasks fallback error:', err);
    return DEFAULT_TASKS;
  }
}

/**
 * Add a new task to Supabase database.
 */
export async function addTask(name: string): Promise<Task> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        name,
        is_active: true,
        sort_order: Date.now(),
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Gagal membuat tugas baru');
    }

    return data as Task;
  } catch (err) {
    console.warn('[settings.service] addTask fallback:', err);
    return {
      id: `task-${Date.now()}`,
      name,
      is_active: true,
      sort_order: Date.now(),
    };
  }
}

/**
 * Update a task name.
 */
export async function updateTaskName(taskId: string, name: string): Promise<Task> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('tasks')
      .update({ name })
      .eq('id', taskId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Gagal update tugas');
    }

    return data as Task;
  } catch (err) {
    console.warn('[settings.service] updateTaskName fallback:', err);
    return { id: taskId, name, is_active: true, sort_order: 1 };
  }
}

/**
 * Soft-delete or hard-delete a task from Supabase.
 */
export async function deleteTask(taskId: string): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.warn('[settings.service] deleteTask error:', error.message);
    }
  } catch (err) {
    console.warn('[settings.service] deleteTask fallback:', err);
  }
}
