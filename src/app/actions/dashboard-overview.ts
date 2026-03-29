"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { lendings, recurringExpenses, transactions } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";
import type { FiatCurrency } from "@/lib/money";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import type { RecurringFrequencyKind } from "@/lib/recurring-expense-labels";
import {
  recurringAmountToMonthlyMinor,
  recurringAmountToYearlyMinor,
} from "@/lib/recurring-monthly-equivalent";
import { decryptFinancePlaintext } from "@/lib/finance-field-crypto";
import {
  normalizeLendingPaymentRow,
  normalizeLendingRow,
} from "@/lib/lending-crypto";
import { resolveRecurringAmountCents } from "@/lib/recurring-amount-crypto";
import { toDecryptedTransaction } from "@/lib/transaction-decrypt";

export type CurrencyOverview = {
  assetsFromActivityMinor: number;
  liabilitiesFromActivityMinor: number;
  /** Outstanding principal still owed to you (receivables), after recorded payments. */
  lendingReceivablesOutstandingMinor: number;
  /** Outstanding principal you still owe (payables), after recorded payments. */
  lendingPayablesOutstandingMinor: number;
  projectedIncomeMinor: number;
  projectedExpenseMinor: number;
  projectedIncomeYearlyMinor: number;
  projectedExpenseYearlyMinor: number;
};

function emptyOverview(): CurrencyOverview {
  return {
    assetsFromActivityMinor: 0,
    liabilitiesFromActivityMinor: 0,
    lendingReceivablesOutstandingMinor: 0,
    lendingPayablesOutstandingMinor: 0,
    projectedIncomeMinor: 0,
    projectedExpenseMinor: 0,
    projectedIncomeYearlyMinor: 0,
    projectedExpenseYearlyMinor: 0,
  };
}

export type TransactionActivityBucket = {
  income: number;
  expense: number;
  accountName: string;
  currency: FiatCurrency;
};

/**
 * Per account+currency income/expense from transactions (same buckets as dashboard position).
 */
export async function computeTransactionBuckets(
  userId: string,
): Promise<Map<string, TransactionActivityBucket>> {
  const db = getDb();
  const txRows = await db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
    with: { financialAccount: true },
  });

  const netByBucket = new Map<string, TransactionActivityBucket>();

  for (const row of txRows) {
    if (row.reducesCreditBalance) continue;
    const tx = toDecryptedTransaction(userId, row);
    const c = tx.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) {
      continue;
    }
    const bucketKey = row.financialAccountId
      ? `${row.financialAccountId}|${c}`
      : `__unassigned|${c}`;
    let b = netByBucket.get(bucketKey);
    if (!b) {
      b = {
        income: 0,
        expense: 0,
        accountName: row.financialAccount
          ? decryptFinancePlaintext(userId, row.financialAccount.name)
          : "(Unassigned)",
        currency: c,
      };
      netByBucket.set(bucketKey, b);
    }
    if (tx.kind === "income") {
      b.income += tx.amountCents;
    } else {
      b.expense += tx.amountCents;
    }
  }

  return netByBucket;
}

/** Dashboard position & recurring projections by currency (matches UI). */
export async function computeDashboardOverviewByCurrency(
  userId: string,
): Promise<{ byCurrency: Record<FiatCurrency, CurrencyOverview> }> {
  const byCurrency: Record<FiatCurrency, CurrencyOverview> = {
    USD: emptyOverview(),
    PHP: emptyOverview(),
  };

  const netByBucket = await computeTransactionBuckets(userId);

  for (const [, b] of netByBucket) {
    const net = b.income - b.expense;
    if (net >= 0) {
      byCurrency[b.currency].assetsFromActivityMinor += net;
    } else {
      byCurrency[b.currency].liabilitiesFromActivityMinor += -net;
    }
  }

  const db = getDb();
  const recurringRows = await db.query.recurringExpenses.findMany({
    where: eq(recurringExpenses.userId, userId),
  });

  for (const item of recurringRows) {
    const amt = resolveRecurringAmountCents(userId, item);
    if (item.amountVariable || amt == null) {
      continue;
    }
    const c = item.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) {
      continue;
    }
    const monthly = recurringAmountToMonthlyMinor(
      amt,
      item.frequency as RecurringFrequencyKind,
    );
    const yearly = recurringAmountToYearlyMinor(
      amt,
      item.frequency as RecurringFrequencyKind,
    );
    if (item.kind === "income") {
      byCurrency[c].projectedIncomeMinor += monthly;
      byCurrency[c].projectedIncomeYearlyMinor += yearly;
    } else {
      byCurrency[c].projectedExpenseMinor += monthly;
      byCurrency[c].projectedExpenseYearlyMinor += yearly;
    }
  }

  const lendingRows = await db.query.lendings.findMany({
    where: eq(lendings.userId, userId),
    with: { payments: true },
  });
  for (const row of lendingRows) {
    const { payments: payList, ...lendRaw } = row;
    const L = normalizeLendingRow(userId, lendRaw);
    const c = L.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) {
      continue;
    }
    const paidCents = payList.reduce(
      (s, p) => s + normalizeLendingPaymentRow(userId, p).amountCents,
      0,
    );
    const remainingCents = Math.max(0, L.principalCents - paidCents);
    if (L.kind === "receivable") {
      byCurrency[c].lendingReceivablesOutstandingMinor += remainingCents;
    } else {
      byCurrency[c].lendingPayablesOutstandingMinor += remainingCents;
    }
  }

  for (const c of SUPPORTED_CURRENCIES) {
    byCurrency[c].assetsFromActivityMinor +=
      byCurrency[c].lendingReceivablesOutstandingMinor;
    byCurrency[c].liabilitiesFromActivityMinor +=
      byCurrency[c].lendingPayablesOutstandingMinor;
  }

  return { byCurrency };
}

/**
 * Assets / liabilities = per-account transaction nets (positive → assets, negative →
 * liabilities) plus outstanding lending: receivables add to assets, payables add to
 * liabilities. Not live bank balances. `lending*` fields are the lending-only portions.
 */
export async function getDashboardOverview(): Promise<{
  byCurrency: Record<FiatCurrency, CurrencyOverview>;
} | null> {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }
  return computeDashboardOverviewByCurrency(userId);
}
