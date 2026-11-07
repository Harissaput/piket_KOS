import { Member, ScheduleEpoch, ScheduleOverride, CompletionLog } from '@/types/database';
import { getDutyMemberForDateWithEpochs } from '@/lib/algorithms/scheduleRotation';
import { formatLocalDate } from '@/lib/utils/date';
import { parseISO, addDays, isAfter } from 'date-fns';

export interface DailyDutyRecord {
  date: string; // YYYY-MM-DD
  dutyMember: Member | null;
  scheduledMember: Member | null; // Petugas asli sebelum override
  override?: ScheduleOverride | null;
  log?: CompletionLog | null;
  effectiveStatus: 'selesai' | 'terlewat' | 'belum' | 'izin' | 'ditukar';
  isHoliday: boolean;
}

export interface MemberPerformanceStats {
  memberId: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string;
  statusAktif: boolean;
  totalJadwal: number;
  totalSelesai: number;
  totalTerlewat: number;
  totalIzin: number;
  totalDitukar: number;
  disciplineRate: number | null; // null jika pembagian 0 -> tampilkan '-'
  streak: number; // Streak selesai berturut-turut terbaru
}

export interface CollectiveReportSummary {
  periodDays: DailyDutyRecord[];
  memberStats: MemberPerformanceStats[];
  totalPiket: number;
  avgDisciplineRate: number | null;
  bestMember: MemberPerformanceStats | null;
}

/**
 * Menghitung daftar tugas piket harian efektif dari tanggal mulai sampai tanggal selesai.
 * Menggabungkan rotasi epoch, override jadwal, dan completion_logs.
 * Hari tanpa log di masa lalu otomatis bertatus 'terlewat' (tampilan saja).
 */
export function computeEffectiveDutyRecords(
  startDateStr: string,
  endDateStr: string,
  members: Member[],
  epochs: ScheduleEpoch[],
  overrides: ScheduleOverride[],
  logs: CompletionLog[],
  hariLibur: string = 'Minggu'
): DailyDutyRecord[] {
  const dStart = parseISO(startDateStr);
  const dEnd = parseISO(endDateStr);

  const todayStr = formatLocalDate(new Date());
  const todayDate = parseISO(todayStr);

  const overrideMap = new Map(overrides.map((o) => [o.date, o]));
  const logMap = new Map(logs.map((l) => [`${l.date}_${l.member_id}`, l]));

  const records: DailyDutyRecord[] = [];
  let cur = dStart;

  while (!isAfter(cur, dEnd)) {
    const curStr = formatLocalDate(cur);
    const dayOfWeek = cur.getDay();
    const isHoliday = hariLibur === 'Minggu' && dayOfWeek === 0;

    if (isHoliday) {
      records.push({
        date: curStr,
        dutyMember: null,
        scheduledMember: null,
        override: null,
        log: null,
        effectiveStatus: 'izin',
        isHoliday: true,
      });
      cur = addDays(cur, 1);
      continue;
    }

    const scheduledDuty = getDutyMemberForDateWithEpochs(cur, members, epochs, startDateStr, hariLibur);
    const override = overrideMap.get(curStr);

    let effectiveDuty: Member | null = scheduledDuty;
    if (override) {
      effectiveDuty = override.new_member_id
        ? members.find((m) => m.id === override.new_member_id) || null
        : null;
    }

    // Cari completion log untuk hari ini
    const memberIdForLog = effectiveDuty ? effectiveDuty.id : scheduledDuty?.id;
    const log = memberIdForLog ? logMap.get(`${curStr}_${memberIdForLog}`) : null;

    let effectiveStatus: 'selesai' | 'terlewat' | 'belum' | 'izin' | 'ditukar' = 'belum';

    if (log) {
      effectiveStatus = log.status;
    } else if (override && override.reason === 'izin' && !override.new_member_id) {
      effectiveStatus = 'izin';
    } else if (override && override.reason === 'swap') {
      effectiveStatus = 'ditukar';
    } else {
      // Jika belum ada log
      if (curStr < todayStr) {
        // Tanggal sudah lewat -> otomatis dihitung terlewat
        effectiveStatus = 'terlewat';
      } else {
        effectiveStatus = 'belum';
      }
    }

    records.push({
      date: curStr,
      dutyMember: effectiveDuty,
      scheduledMember: scheduledDuty,
      override: override || null,
      log: log || null,
      effectiveStatus,
      isHoliday: false,
    });

    cur = addDays(cur, 1);
  }

  return records;
}

/**
 * Menghitung metrik performa & kedisiplinan per anggota.
 * Rumus kedisiplinan: selesai / (selesai + terlewat) * 100
 * Izin dan Ditukar TIDAK dihitung dalam pembagi kedisiplinan.
 */
export function computeMemberPerformanceStats(
  members: Member[],
  records: DailyDutyRecord[]
): MemberPerformanceStats[] {
  const memberStatsList: MemberPerformanceStats[] = [];

  for (const member of members) {
    // Cari semua hari kerja di mana anggota ini menjadi petugas efektif
    const myDays = records.filter(
      (r) => !r.isHoliday && r.dutyMember && r.dutyMember.id === member.id
    );

    const totalJadwal = myDays.length;
    const totalSelesai = myDays.filter((r) => r.effectiveStatus === 'selesai').length;
    const totalTerlewat = myDays.filter((r) => r.effectiveStatus === 'terlewat').length;
    const totalIzin = myDays.filter((r) => r.effectiveStatus === 'izin').length;
    const totalDitukar = myDays.filter((r) => r.effectiveStatus === 'ditukar').length;

    // Pembagi: hanya (selesai + terlewat)
    const evaluatedCount = totalSelesai + totalTerlewat;
    const disciplineRate =
      evaluatedCount > 0 ? Math.round((totalSelesai / evaluatedCount) * 100) : null;

    // Hitung streak 'selesai' terbaru (diurutkan tanggal terbaru ke terlama)
    const sortedPastDays = [...myDays]
      .filter((r) => r.effectiveStatus === 'selesai' || r.effectiveStatus === 'terlewat')
      .sort((a, b) => b.date.localeCompare(a.date));

    let streak = 0;
    for (const d of sortedPastDays) {
      if (d.effectiveStatus === 'selesai') {
        streak++;
      } else {
        break;
      }
    }

    memberStatsList.push({
      memberId: member.id,
      name: member.name,
      avatarColor: member.avatar_color,
      avatarUrl: member.avatar_url,
      statusAktif: member.status_aktif,
      totalJadwal,
      totalSelesai,
      totalTerlewat,
      totalIzin,
      totalDitukar,
      disciplineRate,
      streak,
    });
  }

  return memberStatsList;
}

/**
 * Membuat ringkasan statistik kolektif untuk halaman Laporan.
 */
export function computeCollectiveReportSummary(
  startDateStr: string,
  endDateStr: string,
  members: Member[],
  epochs: ScheduleEpoch[],
  overrides: ScheduleOverride[],
  logs: CompletionLog[],
  hariLibur: string = 'Minggu'
): CollectiveReportSummary {
  const records = computeEffectiveDutyRecords(
    startDateStr,
    endDateStr,
    members,
    epochs,
    overrides,
    logs,
    hariLibur
  );

  const memberStats = computeMemberPerformanceStats(members, records);

  const evaluatedStats = memberStats.filter((m) => m.disciplineRate !== null);
  const avgDisciplineRate =
    evaluatedStats.length > 0
      ? Math.round(
          evaluatedStats.reduce((acc, m) => acc + (m.disciplineRate || 0), 0) /
            evaluatedStats.length
        )
      : null;

  // Best member: kedisiplinan tertinggi, jika seri pilih yang totalSelesai terbanyak
  let bestMember: MemberPerformanceStats | null = null;
  if (evaluatedStats.length > 0) {
    bestMember = [...evaluatedStats].sort((a, b) => {
      const rateA = a.disciplineRate || 0;
      const rateB = b.disciplineRate || 0;
      if (rateB !== rateA) return rateB - rateA;
      return b.totalSelesai - a.totalSelesai;
    })[0];
  }

  const totalPiket = records.filter((r) => !r.isHoliday && r.dutyMember !== null).length;

  return {
    periodDays: records,
    memberStats,
    totalPiket,
    avgDisciplineRate,
    bestMember,
  };
}

/**
 * Menghasilkan konten CSV dengan UTF-8 BOM untuk ekspor laporan (aman dibuka di Excel).
 */
export function generateReportsCsv(
  summary: CollectiveReportSummary,
  periodLabel: string
): string {
  const BOM = '\uFEFF';
  const headers = [
    'Nama Anggota',
    'Status Anggota',
    'Total Jadwal',
    'Selesai',
    'Terlewat',
    'Izin',
    'Ditukar',
    'Kedisiplinan (%)',
    'Streak Saat Ini',
  ];

  const rows = summary.memberStats.map((s) => [
    `"${s.name}"`,
    s.statusAktif ? 'Aktif' : 'Nonaktif',
    s.totalJadwal,
    s.totalSelesai,
    s.totalTerlewat,
    s.totalIzin,
    s.totalDitukar,
    s.disciplineRate !== null ? `${s.disciplineRate}%` : '-',
    s.streak,
  ]);

  const metaRows = [
    [`"LAPORAN PERFORMA PIKET KOS"`],
    [`"Periode: ${periodLabel}"`],
    [`"Total Hari Piket: ${summary.totalPiket}"`],
    [`"Rata-rata Kedisiplinan: ${summary.avgDisciplineRate !== null ? summary.avgDisciplineRate + '%' : '-'}"`],
    [`"Definisi Kedisiplinan: Selesai / (Selesai + Terlewat) * 100 (Izin dan Ditukar tidak dihitung)"`],
    [],
  ];

  const csvContent =
    BOM +
    metaRows.map((r) => r.join(',')).join('\n') +
    '\n' +
    headers.join(',') +
    '\n' +
    rows.map((r) => r.join(',')).join('\n');

  return csvContent;
}
