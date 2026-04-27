"use server";

import { and, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accountTransfers,
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
import { transferAmountCentsFromRow } from "@/lib/transfer-amount";

/**
 * Outstanding lending principal split into a monthly-style projection vs a yearly cap.
 * Installment loans use remaining principal ÷ remaining periods for the monthly figure and
 * min(remaining, 12 × that) for yearly so /yr is not a duplicate of /mo when the loan runs
 * longer than 12 months. Lump-sum: no implied monthly payment — monthly projection is 0;
 * yearly still uses full remaining (obligation within the year view).
 */
function lendingOutstandingProjectionMinor(
  repaymentStyle: "lump_sum" | "installment",
  totalInstallments: number | null,
  remainingCents: number,
  installmentsPaid: number,
): { monthlyMinor: number; yearlyMinor: number } {
  if (remainingCents <= 0) {
    return { monthlyMinor: 0, yearlyMinor: 0 };
  }
  if (
    repaymentStyle === "installment" &&
    totalInstallments != null &&
    totalInstallments > 0
  ) {
    const paid = Math.min(Math.max(0, installmentsPaid), totalInstallments);
    const remainingPeriods = Math.max(1, totalInstallments - paid);
    const perPeriod = Math.ceil(remainingCents / remainingPeriods);
    const yearly = Math.min(remainingCents, perPeriod * 12);
    return { monthlyMinor: perPeriod, yearlyMinor: yearly };
  }
  return { monthlyMinor: 0, yearlyMinor: remainingCents };
}

/** Last N complete calendar months (excluding the current month), average expense transaction volume per month. */
const PROJECTION_EXPENSE_AVG_MONTHS = 6;

async function computeAverageMonthlyExpenseTransactionsMinor(
  userId: string,
): Promise<Record<FiatCurrency, number>> {
  const sums: Record<FiatCurrency, number> = { USD: 0, PHP: 0 };
  const now = new Date();
  const rangeEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeStart = new Date(
    now.getFullYear(),
    now.getMonth() - PROJECTION_EXPENSE_AVG_MONTHS,
    1,
  );

  const db = getDb();
  const rows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.kind, "expense"),
      gte(transactions.occurredAt, rangeStart),
      lt(transactions.occurredAt, rangeEnd),
    ),
  });

  for (const row of rows) {
    const tx = toDecryptedTransaction(userId, row);
    const c = tx.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) continue;
    sums[c] += tx.amountCents;
  }

  const out: Record<FiatCurrency, number> = { USD: 0, PHP: 0 };
  for (const c of SUPPORTED_CURRENCIES) {
    out[c] = Math.round(sums[c] / PROJECTION_EXPENSE_AVG_MONTHS);
  }
  return out;
}

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
  /** Rolling average monthly expense from logged transactions (last 6 full months). */
  projectedExpenseFromTransactionsMinor: number;
  /** Recurring expense templates (monthly equivalent) + installment loan payment estimate per month. */
  projectedExpenseScheduledMinor: number;
  /** Credit card balances owed — shown for context; not included in monthly/yearly expense burn. */
  projectedExpenseExistingObligationsMinor: number;
  /** Avg transactions/mo + scheduled (recurring + installment loans); excludes card balance and lump-sum principal. */
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
    projectedExpenseFromTransactionsMinor: 0,
    projectedExpenseScheduledMinor: 0,
    projectedExpenseExistingObligationsMinor: 0,
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
 * Per account+currency income/expense from transactions + transfers
 * (before starting balances).
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
    if (tx.kind === "income" || tx.reducesCreditBalance) {
      // reducesCreditBalance expenses are bill payments — they reduce the
      // outstanding balance on the account, not add to spending.
      b.income += tx.amountCents;
    } else {
      b.expense += tx.amountCents;
    }
  }

  const transferRows = await db.query.accountTransfers.findMany({
    where: eq(accountTransfers.userId, userId),
    with: { fromAccount: true, toAccount: true },
  });
  for (const row of transferRows) {
    const c = row.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) continue;
    const amt = transferAmountCentsFromRow(userId, row);

    if (row.fromFinancialAccountId) {
      const k = `${row.fromFinancialAccountId}|${c}`;
      let b = netByBucket.get(k);
      if (!b) {
        b = {
          income: 0,
          expense: 0,
          openingMinor: 0,
          accountName: row.fromAccount
            ? decryptFinancePlaintext(userId, row.fromAccount.name)
            : "(Unknown)",
          currency: c,
        };
        netByBucket.set(k, b);
      }
      // Transfer out lowers account balance.
      b.expense += amt;
    }

    if (row.toFinancialAccountId) {
      const k = `${row.toFinancialAccountId}|${c}`;
      let b = netByBucket.get(k);
      if (!b) {
        b = {
          income: 0,
          expense: 0,
          openingMinor: 0,
          accountName: row.toAccount
            ? decryptFinancePlaintext(userId, row.toAccount.name)
            : "(Unknown)",
          currency: c,
        };
        netByBucket.set(k, b);
      }
      // Transfer in raises account balance.
      b.income += amt;
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
  // Receivables explicitly tagged as "borrowed on my credit card".
  const taggedReceivableCreditBorrowMinor: Record<FiatCurrency, number> = {
    USD: 0,
    PHP: 0,
  };

  const avgExpenseTxByCurrency =
    await computeAverageMonthlyExpenseTransactionsMinor(userId);
  for (const c of SUPPORTED_CURRENCIES) {
    byCurrency[c].projectedExpenseFromTransactionsMinor =
      avgExpenseTxByCurrency[c];
  }

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
    byCurrency[c].projectedExpenseExistingObligationsMinor += owed;
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
      byCurrency[c].projectedExpenseScheduledMinor += monthly;
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
    const installmentsPaid = payList.reduce(
      (s, p) => s + (normalizeLendingPaymentRow(userId, p).installmentsCount ?? 1),
      0,
    );
    const { monthlyMinor: lendMo, yearlyMinor: lendYr } =
      lendingOutstandingProjectionMinor(
        L.repaymentStyle,
        L.totalInstallments,
        remainingCents,
        installmentsPaid,
      );
    if (L.kind === "receivable") {
      byCurrency[c].lendingReceivablesOutstandingMinor += remainingCents;
      if (L.linkedCreditAccountId) {
        taggedReceivableCreditBorrowMinor[c] += remainingCents;
      }
    } else {
      byCurrency[c].lendingPayablesOutstandingMinor += remainingCents;
      byCurrency[c].projectedExpenseScheduledMinor += lendMo;
      byCurrency[c].projectedExpenseYearlyMinor += lendYr;
    }
  }

  for (const c of SUPPORTED_CURRENCIES) {
    // Include lending in totals using outstanding balance only (principal minus payments).
    byCurrency[c].assetsFromActivityMinor +=
      byCurrency[c].lendingReceivablesOutstandingMinor;
    byCurrency[c].liabilitiesFromActivityMinor +=
      byCurrency[c].lendingPayablesOutstandingMinor;
    // If a receivable is tagged as someone else's credit-card borrowing, offset it
    // from liabilities and assets equally so balance-sheet net position is unchanged
    // while personal owed liabilities are reduced.
    const tagged = taggedReceivableCreditBorrowMinor[c];
    if (tagged > 0) {
      const offset = Math.min(tagged, byCurrency[c].liabilitiesFromActivityMinor);
      byCurrency[c].liabilitiesFromActivityMinor -= offset;
      byCurrency[c].assetsFromActivityMinor = Math.max(
        0,
        byCurrency[c].assetsFromActivityMinor - offset,
      );
    }
    const txMo = byCurrency[c].projectedExpenseFromTransactionsMinor;
    byCurrency[c].projectedExpenseMinor =
      txMo + byCurrency[c].projectedExpenseScheduledMinor;
    byCurrency[c].projectedExpenseYearlyMinor += txMo * 12;
  }

  return { byCurrency };
}

/**
 * Assets / liabilities = cash-like nets (transactions + starting balances), **plus
 * credit card balances owed** for cards with a limit (`computeCreditUsedCents`), plus
 * lending outstanding balances (remaining principal only).
 * Receivables tagged as "borrowed on my credit card" offset liabilities
 * (and assets by the same offset) so personal owed card balances are reduced
 * without changing net position.
 * Transfers are included in bucket nets for non-credit-limit accounts.
 * Credit-with-limit accounts are skipped in the bucket loop so utilization
 * (which already includes transfers) is not double counted.
 * `creditCardOutstandingMinor` is part of liabilities.
 * `lending*` fields are lending-only totals.
 * Monthly projected expense burn = avg expense transactions (6 mo) + recurring + installment loan payments;
 * credit card balance is liabilities only, not added to projected expense totals.
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
