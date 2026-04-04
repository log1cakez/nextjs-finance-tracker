/** Canonical fingerprint of EOD rows in a calendar month (add/edit/delete aware). */
export function eodMonthJournalDataStamp(
  rows: { id: string; tradeDate: string; updatedAt: string }[],
  yearMonth: string,
): string {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return "";
  return rows
    .filter((r) => r.tradeDate.slice(0, 7) === yearMonth)
    .map((r) => `${r.id}:${r.updatedAt}`)
    .sort()
    .join("\n");
}
