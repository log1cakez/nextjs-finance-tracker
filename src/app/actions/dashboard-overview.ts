"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  financialAccounts,
  lendings,
  recurringExpenses,
  transactions,
} from "@/db/schema";
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
import { computeCreditUsedCents } from "@/lib/credit-utilization";
import { normalizeFinancialAccountRow } from "@/lib/financial-account-crypto";
import { toDecryptedTransaction } from "@/lib/transaction-decrypt";

export type CurrencyOverview = {
  assetsFromActivityMinor: number;
  liabilitiesFromActivityMinor: number;
  /** Credit card balances owed (limit-currency utilization), included in liabilities. */
  creditCardOutstandingMinor: number;
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
    creditCardOutstandingMinor: 0,
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
  /** Starting balance on cash-like accounts (minor units); matches Accounts page. */
  openingMinor: number;
  accountName: string;
  currency: FiatCurrency;
};

/**
 * Per account+currency income/expense from transactions (before starting balances).
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
        openingMinor: 0,
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

async function applyAccountOpeningBalancesToBuckets(
  userId: string,
  netByBucket: Map<string, TransactionActivityBucket>,
): Promise<void> {
  const db = getDb();
  const accounts = await db.query.financialAccounts.findMany({
    where: eq(financialAccounts.userId, userId),
  });
  for (const raw of accounts) {
    const a = normalizeFinancialAccountRow(userId, raw);
    if (a.type === "bank" && a.bankKind === "credit") {
      continue;
    }
    if (a.openingBalanceCents == null || a.openingBalanceCurrency == null) {
      continue;
    }
    const c = a.openingBalanceCurrency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) {
      continue;
    }
    const bucketKey = `${a.id}|${c}`;
    let b = netByBucket.get(bucketKey);
    if (!b) {
      b = {
        income: 0,
        expense: 0,
        openingMinor: 0,
        accountName: decryptFinancePlaintext(userId, a.name),
        currency: c,
      };
      netByBucket.set(bucketKey, b);
    }
    b.openingMinor = a.openingBalanceCents;
  }
}

/** Transaction buckets plus starting balances (e-wallet, debit bank, etc.); used for position. */
export async function mergeTransactionBucketsWithAccountOpenings(
  userId: string,
): Promise<Map<string, TransactionActivityBucket>> {
  const netByBucket = await computeTransactionBuckets(userId);
  await applyAccountOpeningBalancesToBuckets(userId, netByBucket);
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

  const netByBucket = await mergeTransactionBucketsWithAccountOpenings(userId);

  const db = getDb();
  const finAccountsRaw = await db.query.financialAccounts.findMany({
    where: eq(financialAccounts.userId, userId),
  });
  const finAccounts = finAccountsRaw.map((a) =>
    normalizeFinancialAccountRow(userId, a),
  );
  const creditCardWithLimitIds = new Set(
    finAccounts
      .filter(
        (a) =>
          a.type === "bank" &&
          a.bankKind === "credit" &&
          a.creditLimitCents != null &&
          a.creditLimitCurrency != null,
      )
      .map((a) => a.id),
  );

  for (const [bucketKey, b] of netByBucket) {
    const accountId = bucketKey.split("|")[0];
    if (creditCardWithLimitIds.has(accountId)) {
      continue;
    }
    const net = b.income - b.expense + b.openingMinor;
    if (net >= 0) {
      byCurrency[b.currency].assetsFromActivityMinor += net;
    } else {
      byCurrency[b.currency].liabilitiesFromActivityMinor += -net;
    }
  }

  const creditCardsForUtilization = finAccounts.filter(
    (a) =>
      a.type === "bank" &&
      a.bankKind === "credit" &&
      a.creditLimitCents != null &&
      a.creditLimitCurrency != null &&
      SUPPORTED_CURRENCIES.includes(a.creditLimitCurrency as FiatCurrency),
  );
  const creditUsages = await Promise.all(
    creditCardsForUtilization.map(async (a) => {
      const c = a.creditLimitCurrency as FiatCurrency;
      const used = await computeCreditUsedCents(
        userId,
        a.id,
        a.creditOpeningBalanceCents,
        c,
      );
      return { c, owed: Math.max(0, used) };
    }),
  );
  for (const { c, owed } of creditUsages) {
    byCurrency[c].creditCardOutstandingMinor += owed;
    byCurrency[c].liabilitiesFromActivityMinor += owed;
  }

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
 * Assets / liabilities = cash-like nets (transactions + starting balances), **plus
 * credit card balances owed** for cards with a limit (`computeCreditUsedCents`), then
 * lending. Credit-with-limit accounts are skipped in the bucket loop so utilization
 * is not double counted. `creditCardOutstandingMinor` is part of liabilities.
 * `lending*` fields are the lending-only portions.
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
