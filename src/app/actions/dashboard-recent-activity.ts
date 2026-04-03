"use server";

import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accountTransfers,
  categories,
  financialAccounts,
  lendingPayments,
  lendings,
  transactions,
} from "@/db/schema";
import { decryptFinancePlaintext } from "@/lib/finance-field-crypto";
import { normalizeLendingPaymentRow, normalizeLendingRow } from "@/lib/lending-crypto";
import type { FiatCurrency } from "@/lib/money";
import { formatMoney, SUPPORTED_CURRENCIES } from "@/lib/money";
import { getSessionUserId } from "@/lib/session";
import { decryptTransactionPayload } from "@/lib/transaction-crypto";
import {
  toDecryptedTransaction,
  type TransactionRow,
} from "@/lib/transaction-decrypt";
import { transferAmountCentsFromRow } from "@/lib/transfer-amount";

export type DashboardRecentActivityItem = {
  id: string;
  occurredAt: string;
  title: string;
  subtitle: string;
  amountCents: number;
  currency: FiatCurrency;
  sign: 1 | -1;
  badge: "TX" | "TRANSFER" | "LENDING";
};

async function lendingPaymentRowsForUser(userId: string, limit?: number) {
  const db = getDb();
  const loanRows = await db.query.lendings.findMany({
    where: eq(lendings.userId, userId),
    columns: { id: true },
  });
  const loanIds = loanRows.map((r) => r.id);
  if (loanIds.length === 0) {
    return [];
  }
  return db.query.lendingPayments.findMany({
    where: inArray(lendingPayments.lendingId, loanIds),
    orderBy: [desc(lendingPayments.paidAt), desc(lendingPayments.createdAt)],
    limit,
    with: { lending: true },
  });
}

type TxWithRelations = TransactionRow & {
  category: typeof categories.$inferSelect | null;
  financialAccount: typeof financialAccounts.$inferSelect | null;
};

type TransferWithRelations = typeof accountTransfers.$inferSelect & {
  fromAccount: typeof financialAccounts.$inferSelect | null;
  toAccount: typeof financialAccounts.$inferSelect | null;
};

type LendingPaymentWithRelations =
  typeof lendingPayments.$inferSelect & {
    lending: typeof lendings.$inferSelect | null;
  };

function buildActivityItems(
  userId: string,
  txRows: TxWithRelations[],
  transferRows: TransferWithRelations[],
  payRows: LendingPaymentWithRelations[],
): DashboardRecentActivityItem[] {
  const out: DashboardRecentActivityItem[] = [];

  for (const row of txRows) {
    const tx = toDecryptedTransaction(userId, row);
    const c = tx.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) continue;
    const isIncome = tx.kind === "income";
    const isPaydown = row.reducesCreditBalance === true;
    const sign: 1 | -1 = isIncome || isPaydown ? 1 : -1;
    out.push({
      id: row.id,
      occurredAt: new Date(tx.occurredAt).toISOString(),
      title: tx.description,
      subtitle: [
        new Date(tx.occurredAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        "Transaction",
        row.financialAccount?.name
          ? decryptFinancePlaintext(userId, row.financialAccount.name)
          : null,
        row.category?.name ?? null,
        isPaydown ? "card payment" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      amountCents: tx.amountCents,
      currency: c,
      sign,
      badge: "TX",
    });
  }

  for (const row of transferRows) {
    const c = row.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) continue;
    const amt = transferAmountCentsFromRow(userId, row);
    let descText = "Transfer";
    try {
      descText =
        decryptTransactionPayload(userId, row.payload).description || "Transfer";
    } catch {
      /* keep default */
    }
    const fromName = row.fromAccount
      ? decryptFinancePlaintext(userId, row.fromAccount.name)
      : "From";
    const toName = row.toAccount
      ? decryptFinancePlaintext(userId, row.toAccount.name)
      : "To";
    out.push({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      title: descText,
      subtitle: [
        new Date(row.occurredAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        `Transfer · ${fromName} → ${toName}`,
      ].join(" · "),
      amountCents: amt,
      currency: c,
      sign: -1,
      badge: "TRANSFER",
    });
  }

  for (const row of payRows) {
    if (!row.lending || row.lending.userId !== userId) continue;
    const loan = normalizeLendingRow(userId, row.lending);
    const pay = normalizeLendingPaymentRow(userId, row);
    const c = loan.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) continue;
    const sign: 1 | -1 = loan.kind === "receivable" ? 1 : -1;
    const who =
      loan.kind === "receivable"
        ? `${loan.counterpartyName} paid you`
        : `You paid ${loan.counterpartyName}`;
    out.push({
      id: row.id,
      occurredAt: row.paidAt.toISOString(),
      title: who,
      subtitle: [
        new Date(row.paidAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        `Lending payment · ${formatMoney(pay.amountCents, c)}${
          loan.repaymentStyle === "installment" && loan.totalInstallments != null
            ? ` · ${pay.installmentsCount ?? 1}/${loan.totalInstallments}`
            : ""
        }`,
        pay.note ?? null,
      ]
        .filter(Boolean)
        .join(" · "),
      amountCents: pay.amountCents,
      currency: c,
      sign,
      badge: "LENDING",
    });
  }

  return out;
}

export async function getDashboardRecentActivity(
  limit = 10,
): Promise<DashboardRecentActivityItem[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  const db = getDb();

  const take = Math.max(40, limit * 5);

  const [txRows, transferRows, payRows] = await Promise.all([
    db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
      orderBy: [desc(transactions.occurredAt)],
      limit: take,
      with: { category: true, financialAccount: true },
    }),
    db.query.accountTransfers.findMany({
      where: eq(accountTransfers.userId, userId),
      orderBy: [desc(accountTransfers.occurredAt)],
      limit: take,
      with: { fromAccount: true, toAccount: true },
    }),
    lendingPaymentRowsForUser(userId, take),
  ]);

  const out = buildActivityItems(userId, txRows, transferRows, payRows);
  out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return out.slice(0, limit);
}

/** Transactions, transfers, and lending payments — full history, newest first. */
export async function getAllUserActivity(): Promise<DashboardRecentActivityItem[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  const db = getDb();

  const [txRows, transferRows, payRows] = await Promise.all([
    db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
      orderBy: [desc(transactions.occurredAt)],
      with: { category: true, financialAccount: true },
    }),
    db.query.accountTransfers.findMany({
      where: eq(accountTransfers.userId, userId),
      orderBy: [desc(accountTransfers.occurredAt)],
      with: { fromAccount: true, toAccount: true },
    }),
    lendingPaymentRowsForUser(userId),
  ]);

  const out = buildActivityItems(userId, txRows, transferRows, payRows);
  out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return out;
}
