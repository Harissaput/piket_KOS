import { Member, ScheduleEpoch } from '@/types/database';
import { parseISO, startOfWeek, addDays, format } from 'date-fns';

export const PATTERNS = [
  [1, 4], // Senin (1) & Kamis (4) -> Pola 0
  [2, 5], // Selasa (2) & Jumat (5) -> Pola 1
  [3, 6], // Rabu (3) & Sabtu (6) -> Pola 2
];

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const SHORT_DAY_NAMES = ['Minggu', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/**
 * Normalisasi format tanggal YYYY-MM-DD
 */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Mencari epoch yang berlaku untuk tanggal tertentu.
 * Epoch dengan effective_from <= targetDate dan paling baru.
 */
export function getActiveEpochForDate(
  targetDateStr: string,
  epochs: ScheduleEpoch[],
  defaultStartDate: string = '2026-08-31',
  activeMembers: Member[] = []
): { effectiveFrom: string; memberOrder: string[] } {
  if (epochs && epochs.length > 0) {
    const sorted = [...epochs].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    const matched = sorted.find((e) => e.effective_from <= targetDateStr);
    if (matched && matched.member_order && matched.member_order.length > 0) {
      return {
        effectiveFrom: matched.effective_from,
        memberOrder: matched.member_order,
      };
    }
    // Jika sebelum epoch paling awal, pakai epoch paling awal
    const earliest = sorted[sorted.length - 1];
    if (earliest && earliest.member_order && earliest.member_order.length > 0) {
      return {
        effectiveFrom: earliest.effective_from,
        memberOrder: earliest.member_order,
      };
    }
  }

  // Fallback: urutkan anggota aktif berdasarkan order_index
  const fallbackOrder = activeMembers
    .filter((m) => m.status_aktif)
    .sort((a, b) => a.order_index - b.order_index)
    .map((m) => m.id);

  return {
    effectiveFrom: defaultStartDate,
    memberOrder: fallbackOrder,
  };
}

/**
 * Menentukan petugas piket (sebelum override) untuk tanggal tertentu berdasarkan epoch.
 * Logika ini 100% IDENTIK dengan fungsi SQL duty_member_on(p_date).
 */
export function getDutyMemberForDateWithEpochs(
  date: Date,
  members: Member[],
  epochs: ScheduleEpoch[] = [],
  defaultStartDate: string = '2026-08-31',
  hariLibur: string = 'Minggu'
): Member | null {
  const dayOfWeek = date.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  if (hariLibur === 'Minggu' && dayOfWeek === 0) {
    return null;
  }

  const targetDateStr = toDateStr(date);
  const activeEpoch = getActiveEpochForDate(targetDateStr, epochs, defaultStartDate, members);
  const memberOrder = activeEpoch.memberOrder;
  const count = memberOrder.length;

  if (count === 0) return null;

  // 1. Kasus khusus 3 Anggota: Pertahankan rotasi pola mingguan KosPiket (backward compatible)
  if (count === 3) {
    let patternIndex = -1;
    if (dayOfWeek === 1 || dayOfWeek === 4) patternIndex = 0;
    else if (dayOfWeek === 2 || dayOfWeek === 5) patternIndex = 1;
    else if (dayOfWeek === 3 || dayOfWeek === 6) patternIndex = 2;
    else return null;

    // Hitung selisih minggu kalender mulai Senin (persis formula SQL & v2.0)
    const dTarget = parseISO(targetDateStr);
    const dEpoch = parseISO(activeEpoch.effectiveFrom);

    const dowTarget = dTarget.getDay();
    const dowEpoch = dEpoch.getDay();

    // Monday of epoch week
    const monEpoch = new Date(dEpoch);
    monEpoch.setDate(dEpoch.getDate() - ((dowEpoch + 6) % 7));

    // Monday of target week
    const monTarget = new Date(dTarget);
    monTarget.setDate(dTarget.getDate() - ((dowTarget + 6) % 7));

    const diffDays = Math.round((monTarget.getTime() - monEpoch.getTime()) / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);

    const weekIndex = ((diffWeeks % 3) + 3) % 3;
    const targetIdx = ((patternIndex - weekIndex) % 3 + 3) % 3;

    const targetMemberId = memberOrder[targetIdx];
    return members.find((m) => m.id === targetMemberId) || null;
  }

  // 2. Kasus dinamis N Anggota (!= 3):
  // Menghitung hari kerja aktif (Senin s.d. Sabtu) sejak effectiveFrom
  const targetTime = new Date(targetDateStr + 'T00:00:00').getTime();
  const epochTime = new Date(activeEpoch.effectiveFrom + 'T00:00:00').getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (targetTime < epochTime) {
    let offset = 0;
    const diffDays = Math.round((epochTime - targetTime) / dayMs);
    for (let i = 0; i < diffDays; i++) {
      const cur = new Date(targetTime + i * dayMs);
      if (cur.getDay() !== 0) {
        offset++;
      }
    }
    const targetIdx = (((-offset) % count) + count) % count;
    const targetMemberId = memberOrder[targetIdx];
    return members.find((m) => m.id === targetMemberId) || null;
  } else {
    let offset = 0;
    const diffDays = Math.round((targetTime - epochTime) / dayMs);
    for (let i = 0; i < diffDays; i++) {
      const cur = new Date(epochTime + i * dayMs);
      if (cur.getDay() !== 0) {
        offset++;
      }
    }
    const targetIdx = offset % count;
    const targetMemberId = memberOrder[targetIdx];
    return members.find((m) => m.id === targetMemberId) || null;
  }
}

/**
 * Wrapper kompatibel untuk pemanggilan lama yang hanya memberikan (date, members, startDateISO)
 */
export function getDutyMemberForDate(
  date: Date,
  members: Member[],
  startDateISO: string = '2026-08-31',
  epochs: ScheduleEpoch[] = []
): Member | null {
  return getDutyMemberForDateWithEpochs(date, members, epochs, startDateISO, 'Minggu');
}

/**
 * Membuat daftar jadwal mingguan berbasis epoch dan hari libur.
 */
export function getWeeklySchedule(
  referenceDate: Date,
  members: Member[],
  startDateISO: string = '2026-08-31',
  epochs: ScheduleEpoch[] = [],
  hariLibur: string = 'Minggu'
) {
  const monday = startOfWeek(referenceDate, { weekStartsOn: 1 });

  return Array.from({ length: 7 }, (_, i) => {
    const dayDate = addDays(monday, i);
    const dayOfWeek = dayDate.getDay();
    const dutyMember = getDutyMemberForDateWithEpochs(dayDate, members, epochs, startDateISO, hariLibur);

    return {
      date: dayDate,
      dateFormatted: format(dayDate, 'yyyy-MM-dd'),
      dayName: DAY_NAMES[dayOfWeek],
      shortDayName: SHORT_DAY_NAMES[dayOfWeek],
      dayNumber: format(dayDate, 'd'),
      isLibur: dayOfWeek === 0,
      member: dutyMember,
    };
  });
}
