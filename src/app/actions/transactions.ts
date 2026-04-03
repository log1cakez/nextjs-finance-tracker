"use server";

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  categories,
  financialAccounts,
  lendingPayments,
  transactions,
} from "@/db/schema";
import { normalizeLendingPaymentRow, normalizeLendingRow } from "@/lib/lending-crypto";
import { decryptFinancePlaintext } from "@/lib/finance-field-crypto";
import { getSessionUserId } from "@/lib/session";
import {
  endOfLocalDay,
  parseAmountToMinor,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import { getPreferredCurrency } from "@/lib/preferences";
import { formatTypedLabel } from "@/lib/typed-label-format";
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
    financialAccount: financialAccount
      ? {
          ...financialAccount,
          name: decryptFinancePlaintext(userId, financialAccount.name),
        }
      : null,
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

  const creditPaydownRaw = formData.get("creditPaydown");
  const creditPaydown =
    creditPaydownRaw === "on" ||
    creditPaydownRaw === "true" ||
    creditPaydownRaw === "1";
  let reducesCreditBalance = false;
  if (creditPaydown) {
    if (parsed.data.kind !== "expense" || fin.bankKind !== "credit") {
      return {
        error:
          "“Card bill payment” only applies to expenses on a credit card account.",
      };
    }
    reducesCreditBalance = true;
  }

  const description = formatTypedLabel(parsed.data.description.trim());
  if (!description) {
    return { error: "Description is required" };
  }

  let payload: string;
  try {
    payload = encryptTransactionPayload(userId, {
      description,
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
    reducesCreditBalance,
    occurredAt,
  });

  revalidatePath("/financetracker", "layout");
  revalidatePath("/financetracker/transactions");
  revalidatePath("/financetracker/accounts");
  revalidatePath("/financetracker/recurring");
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
  revalidatePath("/financetracker", "layout");
  revalidatePath("/financetracker/transactions");
  revalidatePath("/financetracker/accounts");
  revalidatePath("/financetracker/recurring");
}

export async function computeTransactionsForMonthRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<DecryptedTransaction[]> {
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

export async function getTransactionsForMonth(
  start: Date,
  end: Date,
): Promise<DecryptedTransaction[]> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  return computeTransactionsForMonthRange(userId, start, end);
}

function emptyMonthTotals(): Record<
  FiatCurrency,
  { income: number; expense: number }
> {
  return {
    USD: { income: 0, expense: 0 },
    PHP: { income: 0, expense: 0 },
  };
}

/**
 * All recorded income/expense through `asOfEnd` (inclusive): transactions plus lending
 * payments (receivable = in, payable = out), by currency.
 */
export async function computeActualTotalsByCurrencyThrough(
  userId: string,
  asOfEnd: Date,
): Promise<Record<FiatCurrency, { income: number; expense: number }>> {
  const out = emptyMonthTotals();
  const db = getDb();

  const txRows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      lte(transactions.occurredAt, asOfEnd),
    ),
  });
  for (const row of txRows) {
    const t = toDecryptedTransaction(userId, row);
    const c = t.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) continue;
    if (t.kind === "income") {
      out[c].income += t.amountCents;
    } else {
      out[c].expense += t.amountCents;
    }
  }

  const pays = await db.query.lendingPayments.findMany({
    where: lte(lendingPayments.paidAt, asOfEnd),
    with: { lending: true },
  });
  for (const p of pays) {
    if (!p.lending || p.lending.userId !== userId) continue;
    const loan = normalizeLendingRow(userId, p.lending);
    const pay = normalizeLendingPaymentRow(userId, p);
    const c = loan.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) continue;
    if (loan.kind === "receivable") {
      out[c].income += pay.amountCents;
    } else {
      out[c].expense += pay.amountCents;
    }
  }

  return out;
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

export async function getRecentTransactionsForAccount(
  financialAccountId: string,
  limit = 35,
): Promise<TransactionWithCategory[]> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  if (!z.string().uuid().safeParse(financialAccountId).success) {
    return [];
  }
  const db = getDb();
  const rows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.financialAccountId, financialAccountId),
    ),
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

/**
 * Expense transactions (incl. card paydown rows) from the 1st of this calendar month
 * through end of today (local), plus lending payments on payables. Matches the expense side
 * of the cashflow chart for the current month. Transfers are not expenses.
 */
export async function computeCurrentMonthExpensesByCurrency(
  userId: string,
): Promise<Record<FiatCurrency, number>> {
  const out: Record<FiatCurrency, number> = { USD: 0, PHP: 0 };
  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
  const dataThrough = endOfLocalDay(now);
  const db = getDb();

  const txRows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.kind, "expense"),
      gte(transactions.occurredAt, monthStart),
      lte(transactions.occurredAt, dataThrough),
    ),
  });
  for (const row of txRows) {
    const tx = toDecryptedTransaction(userId, row);
    const c = tx.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) continue;
    out[c] += tx.amountCents;
  }

  const payRows = await db.query.lendingPayments.findMany({
    where: and(
      gte(lendingPayments.paidAt, monthStart),
      lte(lendingPayments.paidAt, dataThrough),
    ),
    with: { lending: true },
  });
  for (const row of payRows) {
    if (!row.lending || row.lending.userId !== userId) continue;
    const loan = normalizeLendingRow(userId, row.lending);
    if (loan.kind !== "payable") continue;
    const pay = normalizeLendingPaymentRow(userId, row);
    const c = loan.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) continue;
    out[c] += pay.amountCents;
  }

  return out;
}

export async function getCurrentMonthExpensesByCurrency(): Promise<Record<
  FiatCurrency,
  number
> | null> {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }
  return computeCurrentMonthExpensesByCurrency(userId);
}

/** Last `monthCount` calendar months of income/expense in `currency` (transactions + lending payments). */
export async function computeMonthlyCashflowTrend(
  userId: string,
  currency: (typeof SUPPORTED_CURRENCIES)[number],
  monthCount = 6,
): Promise<MonthlyCashflowPoint[]> {
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
  const dataThrough = endOfLocalDay(now);

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
    if (od.getTime() > dataThrough.getTime()) continue;
    const key = `${od.getFullYear()}-${String(od.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    if (!b) continue;
    if (tx.kind === "income") {
      b.incomeMinor += tx.amountCents;
    } else {
      b.expenseMinor += tx.amountCents;
    }
  }

  const payRows = await db.query.lendingPayments.findMany({
    where: and(
      gte(lendingPayments.paidAt, rangeStart),
      lte(lendingPayments.paidAt, rangeEnd),
    ),
    with: { lending: true },
  });
  for (const row of payRows) {
    if (!row.lending || row.lending.userId !== userId) continue;
    const loan = normalizeLendingRow(userId, row.lending);
    const pay = normalizeLendingPaymentRow(userId, row);
    if (loan.currency !== currency) continue;
    const od = new Date(row.paidAt);
    if (od.getTime() > dataThrough.getTime()) continue;
    const key = `${od.getFullYear()}-${String(od.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    if (!b) continue;
    if (loan.kind === "receivable") {
      b.incomeMinor += pay.amountCents;
    } else {
      b.expenseMinor += pay.amountCents;
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

export async function getMonthlyCashflowTrend(
  currency: (typeof SUPPORTED_CURRENCIES)[number],
  monthCount = 6,
): Promise<MonthlyCashflowPoint[]> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  return computeMonthlyCashflowTrend(userId, currency, monthCount);
}
