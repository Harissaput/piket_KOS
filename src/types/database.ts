export type MemberStatus = 'belum' | 'selesai' | 'terlewat' | 'izin' | 'ditukar';
export type SwapStatus = 'pending' | 'approved' | 'rejected';
export type OverrideReason = 'swap' | 'izin' | 'manual';
export type Role = 'user' | 'admin';
export type ProfileStatus = 'pending' | 'approved' | 'rejected';

export interface Member {
  id: string;
  name: string;
  order_index: number; // 0=Haris, 1=Fahrul, 2=Ishom
  avatar_url?: string;
  avatar_color: string;
  status_aktif: boolean;
  joined_at: string;
}

export interface Profile {
  id: string;
  member_id: string | null;
  full_name: string;
  email: string;
  role: Role;
  status: ProfileStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  // Joined fields
  member?: Member | null;
  approver?: Profile | null;
}

export interface Settings {
  id: string;
  nama_kost: string;
  start_date: string; // ISO date — titik awal siklus rotasi (Minggu ke-0)
  hari_libur: string; // 'Minggu' by default
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  applies_to_day?: string; // NULL = semua hari; 'Sabtu' = khusus Sabtu
  is_active: boolean;
  sort_order: number;
}

export interface KosRule {
  id: string;
  content: string;
  sort_order: number;
  created_at?: string;
}

export interface TaskItem {
  id: string;
  name: string;
  completed: boolean;
}

export interface ScheduleOverride {
  id: string;
  date: string; // YYYY-MM-DD
  original_member_id: string;
  new_member_id?: string | null; // NULL jika izin tanpa pengganti
  reason: OverrideReason;
  created_by?: string | null;
  created_at: string;
  // Joined fields
  original_member?: Member | null;
  new_member?: Member | null;
  creator_profile?: Profile | null;
}

export interface CompletionLog {
  id: string;
  date: string; // YYYY-MM-DD
  member_id: string;
  status: MemberStatus;
  completed_tasks?: string[]; // IDs or names of checked tasks
  completed_at?: string | null;
  note?: string | null;
  created_at: string;
  // Joined fields
  member?: Member;
}

export interface SwapRequest {
  id: string;
  requester_id: string;
  target_member_id: string;
  date_requester: string; // YYYY-MM-DD
  date_target: string; // YYYY-MM-DD
  status: SwapStatus;
  created_at: string;
  // Joined fields
  requester?: Member;
  target_member?: Member;
}

export interface DaySchedule {
  date: Date;
  dateFormatted: string; // YYYY-MM-DD
  dayName: string; // Senin, Selasa, ...
  shortDayName: string; // Sen, Sel, ...
  dayNumber: string; // '5', '6', ...
  isLibur: boolean;
  member?: Member | null;
  override?: ScheduleOverride;
  completionLog?: CompletionLog;
}
