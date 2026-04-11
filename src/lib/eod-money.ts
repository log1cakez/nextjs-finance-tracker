/** USD formatting for trading dashboard (fixed locale for SSR/client match). */
const USD_LOCALE = "en-US";

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat(USD_LOCALE, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Parse user-entered dollar amount to integer cents; empty → null. */
export function parseUsdToCents(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const cleaned = t.replace(/[$,\s]/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function centsToInputString(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2);
}
