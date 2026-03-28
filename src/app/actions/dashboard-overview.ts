"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { transactions } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";
import type { FiatCurrency } from "@/lib/money";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import type { RecurringFrequencyKind } from "@/lib/recurring-expense-labels";
import {
  recurringAmountToMonthlyMinor,
  recurringAmountToYearlyMinor,
} from "@/lib/recurring-monthly-equivalent";
import { toDecryptedTransaction } from "@/lib/transaction-decrypt";
import { getRecurringExpenses } from "./recurring-expenses";

export type CurrencyOverview = {
  assetsFromActivityMinor: number;
  liabilitiesFromActivityMinor: number;
  projectedIncomeMinor: number;
  projectedExpenseMinor: number;
  projectedIncomeYearlyMinor: number;
  projectedExpenseYearlyMinor: number;
};

function emptyOverview(): CurrencyOverview {
  return {
    assetsFromActivityMinor: 0,
    liabilitiesFromActivityMinor: 0,
    projectedIncomeMinor: 0,
    projectedExpenseMinor: 0,
    projectedIncomeYearlyMinor: 0,
    projectedExpenseYearlyMinor: 0,
  };
}

/**
 * Assets / liabilities = split of per-account net (income − expense) from
 * recorded transactions only — not bank balances. Negative nets count as liabilities.
 */
export async function getDashboardOverview(): Promise<{
  byCurrency: Record<FiatCurrency, CurrencyOverview>;
} | null> {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }

  const byCurrency: Record<FiatCurrency, CurrencyOverview> = {
    USD: emptyOverview(),
    PHP: emptyOverview(),
  };

  const db = getDb();
  const txRows = await db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
  });

  const netByBucket = new Map<string, { income: number; expense: number }>();

  for (const row of txRows) {
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
      b = { income: 0, expense: 0 };
      netByBucket.set(bucketKey, b);
    }
    if (tx.kind === "income") {
      b.income += tx.amountCents;
    } else {
      b.expense += tx.amountCents;
    }
  }

  for (const [key, b] of netByBucket) {
    const currency = key.split("|")[1] as FiatCurrency;
    const net = b.income - b.expense;
    if (net >= 0) {
      byCurrency[currency].assetsFromActivityMinor += net;
    } else {
      byCurrency[currency].liabilitiesFromActivityMinor += -net;
    }
  }

  const recurring = await getRecurringExpenses();
  for (const item of recurring) {
    const c = item.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) {
      continue;
    }
    const monthly = recurringAmountToMonthlyMinor(
      item.amountCents,
      item.frequency as RecurringFrequencyKind,
    );
    const yearly = recurringAmountToYearlyMinor(
      item.amountCents,
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

  return { byCurrency };
}
