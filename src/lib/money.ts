export const SUPPORTED_CURRENCIES = ["USD", "PHP"] as const;

export type FiatCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * FX rate used for app-side USD<->PHP conversion when combining mixed-currency
 * account balances for display.
 *
 * Override with env var `USD_TO_PHP_RATE` (or `NEXT_PUBLIC_USD_TO_PHP_RATE`).
 */
export function getUsdToPhpRate(): number {
  const raw =
    process.env.USD_TO_PHP_RATE ?? process.env.NEXT_PUBLIC_USD_TO_PHP_RATE;
  const n = raw ? Number.parseFloat(raw) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) {
    return 56;
  }
  return n;
}

/** Convert minor units between supported fiat currencies. */
export function convertMinorUnits(
  minorUnits: number,
  from: FiatCurrency,
  to: FiatCurrency,
): number {
  if (from === to) return minorUnits;
  const rate = getUsdToPhpRate();
  if (from === "USD" && to === "PHP") {
    return Math.round(minorUnits * rate);
  }
  // PHP -> USD
  return Math.round(minorUnits / rate);
}

/** Parse a decimal amount string into minor units (cents / centavos). */
export function parseAmountToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** @deprecated Use parseAmountToMinor */
export function dollarsToCents(input: string): number | null {
  return parseAmountToMinor(input);
}

export function formatMoney(
  minorUnits: number,
  currency: FiatCurrency = "USD",
): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export function monthBounds(d = new Date()): { start: Date; end: Date } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(
    d.getFullYear(),
    d.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { start, end };
}

export function totalsByCurrency(
  txs: {
    kind: "income" | "expense";
    amountCents: number;
    currency: FiatCurrency;
    reducesCreditBalance?: boolean;
  }[],
): Record<FiatCurrency, { income: number; expense: number }> {
  const out: Record<FiatCurrency, { income: number; expense: number }> =
    {
      USD: { income: 0, expense: 0 },
      PHP: { income: 0, expense: 0 },
    };
  for (const t of txs) {
    const c = t.currency;
    if (t.kind === "income") {
      out[c].income += t.amountCents;
    } else {
      out[c].expense += t.amountCents;
    }
  }
  return out;
}
