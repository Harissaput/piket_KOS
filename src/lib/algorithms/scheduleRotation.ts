import { Member } from '@/types/database';
import { differenceInCalendarWeeks, parseISO, startOfWeek, addDays, format } from 'date-fns';

export const PATTERNS = [
  [1, 4], // Monday (1) & Thursday (4) -> Pattern 0
  [2, 5], // Tuesday (2) & Friday (5) -> Pattern 1
  [3, 6], // Wednesday (3) & Saturday (6) -> Pattern 2
];

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const SHORT_DAY_NAMES = ['Minggu', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/**
 * Calculates the week index based on a reference startDate (e.g. 2026-08-31 - Monday of Week 0).
 */
export function getWeekIndex(targetDate: Date, startDateISO: string = '2026-08-31'): number {
  const startDate = parseISO(startDateISO);
  const diffWeeks = differenceInCalendarWeeks(targetDate, startDate, { weekStartsOn: 1 });
  // Ensure non-negative modulo index
  return ((diffWeeks % 3) + 3) % 3;
}

/**
 * Determines which member is assigned to a specific date.
 */
export function getDutyMemberForDate(
  date: Date,
  members: Member[],
  startDateISO: string = '2026-08-31'
): Member | null {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  if (dayOfWeek === 0) {
    return null; // Sunday is off day
  }

  const weekIndex = getWeekIndex(date, startDateISO);

  // Find pattern index that contains this dayOfWeek
  const patternIndex = PATTERNS.findIndex((days) => days.includes(dayOfWeek));
  if (patternIndex === -1) return null;

  // We know: (weekIndex + member.order_index) % 3 === patternIndex
  // Therefore: member.order_index = (patternIndex - weekIndex + 3) % 3
  const targetOrderIndex = ((patternIndex - weekIndex) % 3 + 3) % 3;

  return members.find((m) => m.order_index === targetOrderIndex) || null;
}

/**
 * Generates schedule map for a given week date range.
 */
export function getWeeklySchedule(
  referenceDate: Date,
  members: Member[],
  startDateISO: string = '2026-08-31'
) {
  const monday = startOfWeek(referenceDate, { weekStartsOn: 1 });
  
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dayDate = addDays(monday, i);
    const dayOfWeek = dayDate.getDay();
    const dutyMember = getDutyMemberForDate(dayDate, members, startDateISO);
    
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

  return weekDays;
}
