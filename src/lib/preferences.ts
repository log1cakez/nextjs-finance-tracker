import { cookies } from "next/headers";
import type { FiatCurrency } from "@/lib/money";
import { SUPPORTED_CURRENCIES } from "@/lib/money";

export const PREFERRED_CURRENCY_COOKIE = "preferred_currency";

export async function getPreferredCurrency(): Promise<FiatCurrency> {
  const raw = (await cookies()).get(PREFERRED_CURRENCY_COOKIE)?.value;
  if (raw && SUPPORTED_CURRENCIES.includes(raw as FiatCurrency)) {
    return raw as FiatCurrency;
  }
  return "USD";
}
