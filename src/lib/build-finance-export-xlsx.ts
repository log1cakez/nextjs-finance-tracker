import { asc, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import {
  computeDashboardOverviewByCurrency,
  computeTransactionBuckets,
} from "@/app/actions/dashboard-overview";
import {
  computeMonthlyCashflowTrend,
  computeTransactionsForMonthRange,
} from "@/app/actions/transactions";
import { getDb } from "@/db";
import {
  accountTransfers,
  categories,
  financialAccounts,
  lendingPayments,
  lendings,
  recurringExpenses,
  transactions,
} from "@/db/schema";
import { RECURRING_FREQUENCY_LABELS } from "@/lib/recurring-expense-labels";
import type { RecurringFrequencyKind } from "@/lib/recurring-expense-labels";
import { decryptFinancePlaintext } from "@/lib/finance-field-crypto";
import {
  normalizeLendingPaymentRow,
  normalizeLendingRow,
} from "@/lib/lending-crypto";
import { monthBounds, totalsByCurrency, type FiatCurrency } from "@/lib/money";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { resolveRecurringAmountCents } from "@/lib/recurring-amount-crypto";
import { transferAmountCentsFromRow } from "@/lib/transfer-amount";
import { decryptTransactionPayload } from "@/lib/transaction-crypto";
import { toDecryptedTransaction } from "@/lib/transaction-decrypt";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function minorToMajor(n: number): number {
  return n / 100;
}

function recurringScheduleText(row: typeof recurringExpenses.$inferSelect): string {
  const f = RECURRING_FREQUENCY_LABELS[row.frequency as RecurringFrequencyKind];
  if (row.dueWeekday != null) {
    return `${f} · weekday ${row.dueWeekday}`;
  }
  if (row.secondDueDayOfMonth != null && row.dueDayOfMonth != null) {
    return `${f} · days ${row.dueDayOfMonth} & ${row.secondDueDayOfMonth}`;
  }
  if (row.dueDayOfMonth != null) {
    return `${f} · day ${row.dueDayOfMonth}`;
  }
  return f;
}

function appendSheet(
  wb: XLSX.WorkBook,
  name: string,
  rows: Record<string, string | number | boolean | null | undefined>[],
) {
  if (rows.length === 0) {
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

export type FinanceExportOptions = {
  /** User-facing name (workbook + filename base; sanitize in route). */
  userDisplayName: string;
  preferredCurrency: FiatCurrency;
};

/**
 * Builds a multi-sheet .xlsx: dashboard-style calculations, then raw data sheets.
 */
export async function buildFinanceExportXlsxBuffer(
  userId: string,
  options: FinanceExportOptions,
): Promise<Buffer> {
  const { start: monthStart, end: monthEnd } = monthBounds();
  const monthLabel = monthStart.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const exportedAt = new Date().toISOString();

  const [
    { byCurrency },
    buckets,
    monthTx,
    cashflowUsd,
    cashflowPhp,
    txRows,
    catRows,
    acctRows,
    transferRows,
    recurringRows,
    lendingRows,
  ] = await Promise.all([
    computeDashboardOverviewByCurrency(userId),
    computeTransactionBuckets(userId),
    computeTransactionsForMonthRange(userId, monthStart, monthEnd),
    computeMonthlyCashflowTrend(userId, "USD", 6),
    computeMonthlyCashflowTrend(userId, "PHP", 6),
    dbQueryTransactions(userId),
    dbQueryCategories(userId),
    dbQueryAccounts(userId),
    dbQueryTransfers(userId),
    dbQueryRecurring(userId),
    dbQueryLendings(userId),
  ]);

  const monthTotals = totalsByCurrency(monthTx);
  const wb = XLSX.utils.book_new();

  const usd = byCurrency.USD;
  const php = byCurrency.PHP;

  const dashboardRows: Record<string, string | number>[] = [
    {
      Metric: "MIDAS Finance Tracker — dashboard calculations",
      USD: "",
      PHP: "",
      Notes: "",
    },
    {
      Metric: "Exported for",
      USD: "",
      PHP: "",
      Notes: options.userDisplayName,
    },
    {
      Metric: "Exported at (UTC)",
      USD: exportedAt,
      PHP: "",
      Notes: "",
    },
    {
      Metric: "Preferred currency (navbar)",
      USD: options.preferredCurrency,
      PHP: "",
      Notes: "",
    },
    { Metric: "", USD: "", PHP: "", Notes: "" },
    {
      Metric: "— Position & projections (fixed recurring only) —",
      USD: "",
      PHP: "",
      Notes: "",
    },
    {
      Metric: "Assets (from activity)",
      USD: minorToMajor(usd.assetsFromActivityMinor),
      PHP: minorToMajor(php.assetsFromActivityMinor),
      Notes: "Positive per-account nets + lending receivables",
    },
    {
      Metric: "Liabilities (from activity)",
      USD: minorToMajor(usd.liabilitiesFromActivityMinor),
      PHP: minorToMajor(php.liabilitiesFromActivityMinor),
      Notes: "Negative per-account nets + lending payables",
    },
    {
      Metric: "Net position (assets − liabilities)",
      USD: minorToMajor(
        usd.assetsFromActivityMinor - usd.liabilitiesFromActivityMinor,
      ),
      PHP: minorToMajor(
        php.assetsFromActivityMinor - php.liabilitiesFromActivityMinor,
      ),
      Notes: "Transactions + lending combined",
    },
    { Metric: "", USD: "", PHP: "", Notes: "" },
    {
      Metric: "— Lending breakdown (subset of rows above) —",
      USD: "",
      PHP: "",
      Notes: "",
    },
    {
      Metric: "Lending receivables (in assets total)",
      USD: minorToMajor(usd.lendingReceivablesOutstandingMinor),
      PHP: minorToMajor(php.lendingReceivablesOutstandingMinor),
      Notes: "Included in Assets",
    },
    {
      Metric: "Lending payables (in liabilities total)",
      USD: minorToMajor(usd.lendingPayablesOutstandingMinor),
      PHP: minorToMajor(php.lendingPayablesOutstandingMinor),
      Notes: "Included in Liabilities",
    },
    {
      Metric: "Net lending (receivables − payables)",
      USD: minorToMajor(
        usd.lendingReceivablesOutstandingMinor -
          usd.lendingPayablesOutstandingMinor,
      ),
      PHP: minorToMajor(
        php.lendingReceivablesOutstandingMinor -
          php.lendingPayablesOutstandingMinor,
      ),
      Notes: "Same effect as portion of net position from IOUs",
    },
    { Metric: "", USD: "", PHP: "", Notes: "" },
    {
      Metric: "Projected income / month",
      USD: minorToMajor(usd.projectedIncomeMinor),
      PHP: minorToMajor(php.projectedIncomeMinor),
      Notes: "",
    },
    {
      Metric: "Projected expenses / month",
      USD: minorToMajor(usd.projectedExpenseMinor),
      PHP: minorToMajor(php.projectedExpenseMinor),
      Notes: "",
    },
    {
      Metric: "Projected net / month",
      USD: minorToMajor(
        usd.projectedIncomeMinor - usd.projectedExpenseMinor,
      ),
      PHP: minorToMajor(
        php.projectedIncomeMinor - php.projectedExpenseMinor,
      ),
      Notes: "",
    },
    {
      Metric: "Projected income / year",
      USD: minorToMajor(usd.projectedIncomeYearlyMinor),
      PHP: minorToMajor(php.projectedIncomeYearlyMinor),
      Notes: "",
    },
    {
      Metric: "Projected expenses / year",
      USD: minorToMajor(usd.projectedExpenseYearlyMinor),
      PHP: minorToMajor(php.projectedExpenseYearlyMinor),
      Notes: "",
    },
    {
      Metric: "Projected net / year",
      USD: minorToMajor(
        usd.projectedIncomeYearlyMinor - usd.projectedExpenseYearlyMinor,
      ),
      PHP: minorToMajor(
        php.projectedIncomeYearlyMinor - php.projectedExpenseYearlyMinor,
      ),
      Notes: "",
    },
    { Metric: "", USD: "", PHP: "", Notes: "" },
    {
      Metric: `— This month (actual): ${monthLabel} —`,
      USD: "",
      PHP: "",
      Notes: "",
    },
    {
      Metric: "Income (actual)",
      USD: minorToMajor(monthTotals.USD.income),
      PHP: minorToMajor(monthTotals.PHP.income),
      Notes: "",
    },
    {
      Metric: "Expenses (actual)",
      USD: minorToMajor(monthTotals.USD.expense),
      PHP: minorToMajor(monthTotals.PHP.expense),
      Notes: "",
    },
    {
      Metric: "Net (actual)",
      USD: minorToMajor(monthTotals.USD.income - monthTotals.USD.expense),
      PHP: minorToMajor(monthTotals.PHP.income - monthTotals.PHP.expense),
      Notes: "",
    },
    { Metric: "", USD: "", PHP: "", Notes: "" },
    {
      Metric: "— Cashflow trend: see sheet 'Cashflow trend' —",
      USD: "Last 6 months",
      PHP: "by currency",
      Notes: "",
    },
  ];
  appendSheet(wb, "Dashboard", dashboardRows);

  const activityRows = Array.from(buckets.values())
    .map((b) => {
      const net = b.income - b.expense;
      return {
        Account: b.accountName,
        Currency: b.currency,
        Income: minorToMajor(b.income),
        Expense: minorToMajor(b.expense),
        Net: minorToMajor(net),
        "Counts toward":
          net >= 0 ? "Assets (from activity)" : "Liabilities (from activity)",
      };
    })
    .sort((a, b) =>
      `${a.Currency} ${a.Account}`.localeCompare(`${b.Currency} ${b.Account}`),
    );
  appendSheet(wb, "Activity by account", activityRows);

  const cashflowRows: Record<string, string | number>[] = [];
  for (const c of SUPPORTED_CURRENCIES) {
    const pts = c === "USD" ? cashflowUsd : cashflowPhp;
    for (const p of pts) {
      cashflowRows.push({
        Currency: c,
        "Month key": p.key,
        "Month label": p.label,
        Income: minorToMajor(p.incomeMinor),
        Expense: minorToMajor(p.expenseMinor),
        Net: minorToMajor(p.incomeMinor - p.expenseMinor),
      });
    }
  }
  appendSheet(wb, "Cashflow trend", cashflowRows);

  const transactionExport = txRows.map((row) => {
    const { category, financialAccount, ...raw } = row;
    const tx = toDecryptedTransaction(userId, raw);
    return {
      Date: isoDate(new Date(tx.occurredAt)),
      Description: tx.description,
      Kind: tx.kind,
      Amount: tx.amountCents / 100,
      Currency: tx.currency,
      "Card bill payment": raw.reducesCreditBalance ? "yes" : "",
      Category: category?.name ?? "",
      Account: financialAccount
        ? decryptFinancePlaintext(userId, financialAccount.name)
        : "",
    };
  });
  appendSheet(wb, "Transactions", transactionExport);

  appendSheet(
    wb,
    "Categories",
    catRows.map((c) => ({
      Name: c.name,
      Kind: c.kind,
    })),
  );

  appendSheet(
    wb,
    "Accounts",
    acctRows.map((a) => ({
      Name: decryptFinancePlaintext(userId, a.name),
      Type: a.type,
    })),
  );

  const transfersOut = transferRows
    .map((row) => {
      const { fromAccount, toAccount, payload, ...rest } = row;
      if (!fromAccount || !toAccount) {
        return null;
      }
      let description = "[Could not read]";
      try {
        description = decryptTransactionPayload(userId, payload).description;
      } catch {
        /* keep placeholder */
      }
      return {
        Date: isoDate(new Date(rest.occurredAt)),
        Amount:
          transferAmountCentsFromRow(userId, {
            amountCents: rest.amountCents,
            payload,
          }) / 100,
        Currency: rest.currency,
        From: decryptFinancePlaintext(userId, fromAccount.name),
        To: decryptFinancePlaintext(userId, toAccount.name),
        Description: description,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  appendSheet(wb, "Transfers", transfersOut);

  appendSheet(
    wb,
    "Recurring",
    recurringRows.map((r) => ({
      Name: decryptFinancePlaintext(userId, r.name),
      Kind: r.kind,
      "Amount (fixed)": (() => {
        const a = resolveRecurringAmountCents(userId, r);
        return a != null ? a / 100 : "";
      })(),
      "Variable amount": r.amountVariable ? "Yes" : "No",
      Currency: r.currency,
      Schedule: recurringScheduleText(r),
      Account: r.financialAccount
        ? decryptFinancePlaintext(userId, r.financialAccount.name)
        : "",
      Category: r.category?.name ?? "",
      "Card bill payment": r.creditPaydown ? "Yes" : "No",
    })),
  );

  const lendingSummary = lendingRows.map((raw) => {
    const { payments, ...lr } = raw;
    const L = normalizeLendingRow(userId, lr);
    const paid = payments.reduce(
      (s, p) => s + normalizeLendingPaymentRow(userId, p).amountCents,
      0,
    );
    const remaining = Math.max(0, L.principalCents - paid);
    return {
      Counterparty: L.counterpartyName,
      Kind: L.kind,
      Principal: L.principalCents / 100,
      "Paid total": paid / 100,
      Remaining: remaining / 100,
      Currency: L.currency,
      Started: isoDate(new Date(L.startedAt)),
      "Repayment style": L.repaymentStyle,
      Notes: L.notes ?? "",
    };
  });
  appendSheet(wb, "Lending", lendingSummary);

  const paymentLines: Record<string, string | number>[] = [];
  for (const raw of lendingRows) {
    const { payments, ...lr } = raw;
    const L = normalizeLendingRow(userId, lr);
    for (const p of payments) {
      const np = normalizeLendingPaymentRow(userId, p);
      paymentLines.push({
        Counterparty: L.counterpartyName,
        "Loan kind": L.kind,
        Amount: np.amountCents / 100,
        Currency: L.currency,
        "Paid date": isoDate(new Date(np.paidAt)),
        Note: np.note ?? "",
      });
    }
  }
  appendSheet(wb, "Lending payments", paymentLines);

  if (!wb.SheetNames.length) {
    appendSheet(wb, "Info", [
      {
        Message: "No data to export yet.",
        Exported: exportedAt,
      },
    ]);
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function dbQueryTransactions(userId: string) {
  const db = getDb();
  return db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
    orderBy: [asc(transactions.occurredAt)],
    with: { category: true, financialAccount: true },
  });
}

async function dbQueryCategories(userId: string) {
  const db = getDb();
  return db.query.categories.findMany({
    where: eq(categories.userId, userId),
    orderBy: [asc(categories.kind), asc(categories.name)],
  });
}

async function dbQueryAccounts(userId: string) {
  const db = getDb();
  return db.query.financialAccounts.findMany({
    where: eq(financialAccounts.userId, userId),
    orderBy: [asc(financialAccounts.type), asc(financialAccounts.createdAt)],
  });
}

async function dbQueryTransfers(userId: string) {
  const db = getDb();
  return db.query.accountTransfers.findMany({
    where: eq(accountTransfers.userId, userId),
    orderBy: [asc(accountTransfers.occurredAt)],
    with: { fromAccount: true, toAccount: true },
  });
}

async function dbQueryRecurring(userId: string) {
  const db = getDb();
  return db.query.recurringExpenses.findMany({
    where: eq(recurringExpenses.userId, userId),
    orderBy: [asc(recurringExpenses.kind), asc(recurringExpenses.createdAt)],
    with: { category: true, financialAccount: true },
  });
}

async function dbQueryLendings(userId: string) {
  const db = getDb();
  return db.query.lendings.findMany({
    where: eq(lendings.userId, userId),
    orderBy: [asc(lendings.startedAt)],
    with: { payments: { orderBy: [asc(lendingPayments.paidAt)] } },
  });
}
