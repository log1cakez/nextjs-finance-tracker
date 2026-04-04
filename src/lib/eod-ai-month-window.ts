/**
 * Whether `ref` (local calendar) falls in the last three days of the month given by `yearMonth` (YYYY-MM).
 * Example: April 2026 → enabled on local dates Apr 29–30 (and Apr 31 if it existed).
 */
export function isLocalDateInLastThreeDaysOfYearMonth(
  ref: Date,
  yearMonth: string,
): boolean {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return false;
  const [y, m] = yearMonth.split("-").map(Number);
  if (ref.getFullYear() !== y || ref.getMonth() + 1 !== m) return false;
  const lastDay = new Date(y, m, 0).getDate();
  const d = ref.getDate();
  return d >= lastDay - 2;
}
