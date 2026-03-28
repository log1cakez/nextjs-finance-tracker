"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SUPPORTED_CURRENCIES, type FiatCurrency } from "@/lib/money";
import { PREFERRED_CURRENCY_COOKIE } from "@/lib/preferences";

export async function setPreferredCurrency(currency: string) {
  if (!SUPPORTED_CURRENCIES.includes(currency as FiatCurrency)) {
    return;
  }
  const store = await cookies();
  store.set(PREFERRED_CURRENCY_COOKIE, currency, {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
    httpOnly: true,
  });
  revalidatePath("/", "layout");
}
