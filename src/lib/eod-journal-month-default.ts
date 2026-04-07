import type { EodTrackerRow } from "@/app/actions/eod-tracker-rows";

/**
 * Default journal month for the EOD UI. When there are no rows, use UTC YYYY-MM so SSR and
 * the first client render match (avoids hydration mismatch from local `Date` in the browser).
 */
export function getInitialJournalMonthFromRows(rows: EodTrackerRow[]): string {
  if (rows.length === 0) {
    return new Date().toISOString().slice(0, 7);
  }
  let best = rows[0]!.tradeDate.slice(0, 7);
  for (const r of rows) {
    const ym = r.tradeDate.slice(0, 7);
    if (ym > best) best = ym;
  }
  return best;
}
