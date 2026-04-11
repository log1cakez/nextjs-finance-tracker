"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { eodTradingAccounts } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";

const upsertSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  initialCapitalCents: z.number().int().min(0).max(1_000_000_000_000),
});

export type EodTradingAccount = {
  id: string;
  name: string;
  initialCapitalCents: number;
  createdAt: string;
  updatedAt: string;
};

export async function listEodTradingAccounts(): Promise<EodTradingAccount[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  try {
    const rows = await getDb()
      .select({
        id: eodTradingAccounts.id,
        name: eodTradingAccounts.name,
        initialCapitalCents: eodTradingAccounts.initialCapitalCents,
        createdAt: eodTradingAccounts.createdAt,
        updatedAt: eodTradingAccounts.updatedAt,
      })
      .from(eodTradingAccounts)
      .where(eq(eodTradingAccounts.userId, userId))
      .orderBy(asc(eodTradingAccounts.name));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      initialCapitalCents: r.initialCapitalCents,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function createEodTradingAccount(
  input: z.infer<typeof upsertSchema>,
): Promise<{ id: string } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Sign in required" };
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const [row] = await getDb()
      .insert(eodTradingAccounts)
      .values({
        userId,
        name: parsed.data.name,
        initialCapitalCents: parsed.data.initialCapitalCents,
      })
      .returning({ id: eodTradingAccounts.id });
    if (!row) return { error: "Could not create account" };
    revalidatePath("/eod-tracker");
    return { id: row.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "You already have an account with that name." };
    }
    if (msg.includes("eod_trading_account") && msg.includes("does not exist")) {
      return { error: "Run `npm run db:migrate` or `npm run db:push` to add trading accounts." };
    }
    return { error: "Could not create account." };
  }
}

export async function updateEodTradingAccount(
  id: string,
  input: z.infer<typeof upsertSchema>,
): Promise<{ ok: true } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Sign in required" };
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const updated = await getDb()
      .update(eodTradingAccounts)
      .set({
        name: parsed.data.name,
        initialCapitalCents: parsed.data.initialCapitalCents,
        updatedAt: new Date(),
      })
      .where(and(eq(eodTradingAccounts.id, id), eq(eodTradingAccounts.userId, userId)))
      .returning({ id: eodTradingAccounts.id });
    if (updated.length === 0) return { error: "Account not found" };
    revalidatePath("/eod-tracker");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "You already have an account with that name." };
    }
    return { error: "Could not update account." };
  }
}

export async function deleteEodTradingAccount(id: string): Promise<{ ok: true } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Sign in required" };
  try {
    const removed = await getDb()
      .delete(eodTradingAccounts)
      .where(and(eq(eodTradingAccounts.id, id), eq(eodTradingAccounts.userId, userId)))
      .returning({ id: eodTradingAccounts.id });
    if (removed.length === 0) return { error: "Account not found" };
    revalidatePath("/eod-tracker");
    return { ok: true };
  } catch {
    return { error: "Could not delete account." };
  }
}
