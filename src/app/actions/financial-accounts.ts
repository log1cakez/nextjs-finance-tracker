"use server";

import { and, asc, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  accountTransfers,
  financialAccounts,
  recurringExpenses,
  transactions,
} from "@/db/schema";
import { getSessionUserId } from "@/lib/session";
import { FINANCE_ACCOUNT_TYPES } from "@/lib/financial-account-labels";

const typeSchema = z.enum(FINANCE_ACCOUNT_TYPES);

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  type: typeSchema,
});

export type FinancialAccountActionState = {
  error?: string;
  success?: boolean;
};

export async function createFinancialAccount(
  _prev: FinancialAccountActionState,
  formData: FormData,
): Promise<FinancialAccountActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  await getDb().insert(financialAccounts).values({
    userId,
    name: parsed.data.name.trim(),
    type: parsed.data.type,
  });

  revalidatePath("/accounts");
  revalidatePath("/", "layout");
  revalidatePath("/transactions");
  revalidatePath("/recurring");
  revalidatePath("/transfers");
  return { success: true };
}

export async function deleteFinancialAccount(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return;
  }

  const db = getDb();
  const txInUse = await db.query.transactions.findFirst({
    where: eq(transactions.financialAccountId, id),
  });
  const recurringInUse = await db.query.recurringExpenses.findFirst({
    where: eq(recurringExpenses.financialAccountId, id),
  });
  const transferInUse = await db.query.accountTransfers.findFirst({
    where: and(
      eq(accountTransfers.userId, userId),
      or(
        eq(accountTransfers.fromFinancialAccountId, id),
        eq(accountTransfers.toFinancialAccountId, id),
      ),
    ),
  });
  if (txInUse || recurringInUse || transferInUse) {
    redirect("/accounts?error=in_use");
  }

  await db
    .delete(financialAccounts)
    .where(
      and(eq(financialAccounts.id, id), eq(financialAccounts.userId, userId)),
    );

  revalidatePath("/accounts");
  revalidatePath("/", "layout");
  revalidatePath("/transactions");
  revalidatePath("/recurring");
  revalidatePath("/transfers");
}

export async function getFinancialAccounts() {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const db = getDb();
  return db.query.financialAccounts.findMany({
    where: eq(financialAccounts.userId, userId),
    orderBy: [
      asc(financialAccounts.type),
      asc(financialAccounts.name),
    ],
  });
}
