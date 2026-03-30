import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appFxRates } from "@/db/schema";
import type { FiatCurrency } from "@/lib/money";

export const USD_PHP_ROW_ID = "usd_php";
const PPM = 1_000_000;

export function envUsdToPhpFallback(): number {
  const raw =
    process.env.USD_TO_PHP_RATE ?? process.env.NEXT_PUBLIC_USD_TO_PHP_RATE;
  const n = raw ? Number.parseFloat(raw) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return 56;
  return n;
}

export async function getUsdToPhpRateFromDbOrEnv(): Promise<number> {
  try {
    const row = await getDb().query.appFxRates.findFirst({
      where: eq(appFxRates.id, USD_PHP_ROW_ID),
    });
    if (!row) return envUsdToPhpFallback();
    return row.usdToPhpRatePpm / PPM;
  } catch (err: unknown) {
    // Migration may not be applied yet (missing table/column). Keep app usable.
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (
      msg.includes("app_fx_rates") ||
      msg.includes("does not exist") ||
      msg.includes("failed query")
    ) {
      return envUsdToPhpFallback();
    }
    throw err;
  }
}

export function convertMinorUnitsWithRate(
  minorUnits: number,
  from: FiatCurrency,
  to: FiatCurrency,
  usdToPhp: number,
): number {
  if (from === to) return minorUnits;
  if (from === "USD" && to === "PHP") {
    return Math.round(minorUnits * usdToPhp);
  }
  return Math.round(minorUnits / usdToPhp);
}

