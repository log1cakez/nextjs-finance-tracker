"use server";

import { getUsdToPhpRateFromDbOrEnv } from "@/lib/fx-rates";

/** Current cached USD -> PHP rate, for client components that need it on demand. */
export async function getCurrentUsdToPhpRate(): Promise<number> {
  return getUsdToPhpRateFromDbOrEnv();
}
