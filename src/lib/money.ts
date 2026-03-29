export const SUPPORTED_CURRENCIES = ["USD", "PHP"] as const;

export type FiatCurrency = (typeof SUPPORTED_CURRENCIES)[number];

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
    if (t.kind === "expense" && t.reducesCreditBalance) continue;
    const c = t.currency;
    if (t.kind === "income") {
      out[c].income += t.amountCents;
    } else {
      out[c].expense += t.amountCents;
    }
  }
  return out;
}
