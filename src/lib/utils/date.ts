import { format } from 'date-fns';

/**
 * Format a Date object to YYYY-MM-DD in local system time (Asia/Jakarta / WIB).
 * Prevents UTC timezone shift bug where toISOString() retreats by 1 day before 07:00 WIB.
 */
export function formatLocalDate(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}
