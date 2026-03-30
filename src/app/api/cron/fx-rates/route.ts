import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { appFxRates } from "@/db/schema";
import { USD_PHP_ROW_ID, envUsdToPhpFallback } from "@/lib/fx-rates";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (expected && token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rate = envUsdToPhpFallback();
  let source = "env-fallback";
  try {
    // Public endpoint, no API key required
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as {
        rates?: Record<string, number>;
        result?: string;
      };
      const php = data?.rates?.PHP;
      if (
        data?.result !== "error" &&
        typeof php === "number" &&
        Number.isFinite(php) &&
        php > 0
      ) {
        rate = php;
        source = "open.er-api.com";
      }
    }
  } catch {
    // keep fallback
  }

  const ppm = Math.round(rate * 1_000_000);
  await getDb()
    .insert(appFxRates)
    .values({
      id: USD_PHP_ROW_ID,
      usdToPhpRatePpm: ppm,
      source,
    })
    .onConflictDoUpdate({
      target: appFxRates.id,
      set: {
        usdToPhpRatePpm: ppm,
        source,
        updatedAt: new Date(),
      },
    });

  const row = await getDb().query.appFxRates.findFirst({
    where: eq(appFxRates.id, USD_PHP_ROW_ID),
  });

  return NextResponse.json({
    ok: true,
    usdToPhpRate: rate,
    source: row?.source ?? source,
    updatedAt: row?.updatedAt?.toISOString() ?? new Date().toISOString(),
  });
}

