"use server";

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { categories, financialAccounts, transactions } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";
import {
  parseAmountToMinor,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import { getPreferredCurrency } from "@/lib/preferences";
import { encryptTransactionPayload } from "@/lib/transaction-crypto";
import {
  toDecryptedTransaction,
  type DecryptedTransaction,
  type TransactionRow,
} from "@/lib/transaction-decrypt";

const createSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  amount: z.string().min(1, "Amount is required"),
  currency: z.enum(SUPPORTED_CURRENCIES),
  kind: z.enum(["income", "expense"]),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  financialAccountId: z.string().min(1, "Pick an account").uuid(),
  occurredAt: z.string().min(1, "Date is required"),
});

export type TransactionActionState = {
  error?: string;
  success?: boolean;
};

export type TransactionWithCategory = DecryptedTransaction & {
  category: (typeof categories.$inferSelect) | null;
  financialAccount: (typeof financialAccounts.$inferSelect) | null;
};

function mapWithCategory(
  userId: string,
  row: TransactionRow & {
    category: (typeof categories.$inferSelect) | null;
    financialAccount: (typeof financialAccounts.$inferSelect) | null;
  },
): TransactionWithCategory {
  const { category, financialAccount, ...tx } = row;
  return {
    ...toDecryptedTransaction(userId, tx),
    category,
    financialAccount,
  };
}

export async function createTransaction(
  _prev: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }

  const preferred = await getPreferredCurrency();
  const curRaw = formData.get("currency");
  const currencyResolved: FiatCurrency =
    typeof curRaw === "string" &&
    SUPPORTED_CURRENCIES.includes(curRaw as FiatCurrency)
      ? (curRaw as FiatCurrency)
      : preferred;

  const parsed = createSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: currencyResolved,
    kind: formData.get("kind"),
    categoryId: formData.get("categoryId") || "",
    financialAccountId: formData.get("financialAccountId"),
    occurredAt: formData.get("occurredAt"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const minor = parseAmountToMinor(parsed.data.amount);
  if (minor === null) {
    return { error: "Enter a valid positive amount" };
  }

  const occurredAt = new Date(`${parsed.data.occurredAt}T12:00:00`);
  if (Number.isNaN(occurredAt.getTime())) {
    return { error: "Invalid date" };
  }

  const categoryId =
    parsed.data.categoryId && parsed.data.categoryId.length > 0
      ? parsed.data.categoryId
      : null;

  const db = getDb();

  if (categoryId) {
    const cat = await db.query.categories.findFirst({
      where: and(eq(categories.id, categoryId), eq(categories.userId, userId)),
    });
    if (!cat || cat.kind !== parsed.data.kind) {
      return { error: "Pick a category that matches income or expense" };
    }
  }

  const fin = await db.query.financialAccounts.findFirst({
    where: and(
      eq(financialAccounts.id, parsed.data.financialAccountId),
      eq(financialAccounts.userId, userId),
    ),
  });
  if (!fin) {
    return { error: "Pick a valid account" };
  }

  let payload: string;
  try {
    payload = encryptTransactionPayload(userId, {
      description: parsed.data.description.trim(),
      amountCents: minor,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
      return {
        error:
          "Server encryption is not configured. Set TRANSACTIONS_ENCRYPTION_KEY (e.g. openssl rand -hex 32).",
      };
    }
    return { error: "Could not encrypt transaction. Try again." };
  }

  await db.insert(transactions).values({
    userId,
    payload,
    description: null,
    amountCents: null,
    currency: parsed.data.currency,
    kind: parsed.data.kind,
    categoryId,
    financialAccountId: parsed.data.financialAccountId,
    occurredAt,
  });

  revalidatePath("/", "layout");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/recurring");
  return { success: true };
}

export async function deleteTransaction(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return;
  }
  await getDb()
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  revalidatePath("/", "layout");
  revalidatePath("/transactions");
  revalidatePath("/recurring");
}

export async function getTransactionsForMonth(
  start: Date,
  end: Date,
): Promise<DecryptedTransaction[]> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const db = getDb();
  const rows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      gte(transactions.occurredAt, start),
      lte(transactions.occurredAt, end),
    ),
  });
  return rows.map((r) => toDecryptedTransaction(userId, r));
}

export async function getRecentTransactions(
  limit = 10,
): Promise<TransactionWithCategory[]> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const db = getDb();
  const rows = await db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
    orderBy: [desc(transactions.occurredAt)],
    limit,
    with: { category: true, financialAccount: true },
  });
  return rows.map((r) => mapWithCategory(userId, r));
}

export async function getAllTransactions(): Promise<TransactionWithCategory[]> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const db = getDb();
  const rows = await db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
    orderBy: [desc(transactions.occurredAt)],
    with: { category: true, financialAccount: true },
  });
  return rows.map((r) => mapWithCategory(userId, r));
}

export type MonthlyCashflowPoint = {
  /** YYYY-MM for stable keys */
  key: string;
  label: string;
  incomeMinor: number;
  expenseMinor: number;
};

/** Last `monthCount` calendar months of income/expense in `currency` (actual transactions). */
export async function getMonthlyCashflowTrend(
  currency: (typeof SUPPORTED_CURRENCIES)[number],
  monthCount = 6,
): Promise<MonthlyCashflowPoint[]> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }

  const now = new Date();
  const count = Math.min(Math.max(monthCount, 1), 24);
  const startMonth = new Date(now.getFullYear(), now.getMonth() - (count - 1), 1);
  const rangeStart = new Date(
    startMonth.getFullYear(),
    startMonth.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
  const rangeEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  const buckets = new Map<
    string,
    { label: string; incomeMinor: number; expenseMinor: number }
  >();
  for (let i = 0; i < count; i++) {
    const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    });
    buckets.set(key, { label, incomeMinor: 0, expenseMinor: 0 });
  }

  const db = getDb();
  const rows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      gte(transactions.occurredAt, rangeStart),
      lte(transactions.occurredAt, rangeEnd),
    ),
  });

  for (const row of rows) {
    const tx = toDecryptedTransaction(userId, row);
    if (tx.currency !== currency) continue;
    const od = new Date(tx.occurredAt);
    const key = `${od.getFullYear()}-${String(od.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    if (!b) continue;
    if (tx.kind === "income") {
      b.incomeMinor += tx.amountCents;
    } else {
      b.expenseMinor += tx.amountCents;
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key,
      label: v.label,
      incomeMinor: v.incomeMinor,
      expenseMinor: v.expenseMinor,
    }));
}
