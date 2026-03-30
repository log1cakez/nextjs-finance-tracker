"use server";

import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accountTransfers,
  financialAccounts,
  lendingPayments,
  lendings,
  transactions,
} from "@/db/schema";
import { decryptFinancePlaintext } from "@/lib/finance-field-crypto";
import { normalizeLendingPaymentRow, normalizeLendingRow } from "@/lib/lending-crypto";
import { formatMoney, type FiatCurrency, SUPPORTED_CURRENCIES } from "@/lib/money";
import { getSessionUserId } from "@/lib/session";
import { decryptTransactionPayload } from "@/lib/transaction-crypto";
import { toDecryptedTransaction } from "@/lib/transaction-decrypt";
import { transferAmountCentsFromRow } from "@/lib/transfer-amount";

export type AccountActivityItem =
  | {
      id: string;
      occurredAt: string;
      type: "transaction";
      title: string;
      subtitle: string;
      amountCents: number;
      currency: FiatCurrency;
      sign: 1 | -1;
    }
  | {
      id: string;
      occurredAt: string;
      type: "transfer";
      title: string;
      subtitle: string;
      amountCents: number;
      currency: FiatCurrency;
      sign: 1 | -1;
    }
  | {
      id: string;
      occurredAt: string;
      type: "lending_payment";
      title: string;
      subtitle: string;
      amountCents: number;
      currency: FiatCurrency;
      sign: 1 | -1;
    };

export async function getRecentAccountActivity(
  accountId: string,
  limit = 35,
): Promise<AccountActivityItem[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];

  const db = getDb();
  const acc = await db.query.financialAccounts.findFirst({
    where: and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)),
    columns: { id: true, name: true },
  });
  if (!acc) return [];

  const [txRows, transferRows, paymentRows] = await Promise.all([
    db.query.transactions.findMany({
      where: and(eq(transactions.userId, userId), eq(transactions.financialAccountId, accountId)),
      orderBy: [desc(transactions.occurredAt)],
      with: { category: true },
      limit: Math.max(80, limit * 3),
    }),
    db.query.accountTransfers.findMany({
      where: and(
        eq(accountTransfers.userId, userId),
        or(
          eq(accountTransfers.fromFinancialAccountId, accountId),
          eq(accountTransfers.toFinancialAccountId, accountId),
        ),
      ),
      orderBy: [desc(accountTransfers.occurredAt)],
      with: { fromAccount: true, toAccount: true },
      limit: Math.max(80, limit * 3),
    }),
    db.query.lendingPayments.findMany({
      where: eq(lendingPayments.financialAccountId, accountId),
      orderBy: [desc(lendingPayments.paidAt), desc(lendingPayments.createdAt)],
      with: { lending: true },
      limit: Math.max(80, limit * 3),
    }),
  ]);

  const out: AccountActivityItem[] = [];

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
      type: "transaction",
      title: tx.description,
      subtitle: [
        "Transaction",
        row.category?.name ?? null,
        isPaydown ? "card payment" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      amountCents: tx.amountCents,
      currency: c,
      sign,
    });
  }

  for (const row of transferRows) {
    const c = row.currency as FiatCurrency;
    if (!SUPPORTED_CURRENCIES.includes(c)) continue;
    const amt = transferAmountCentsFromRow(userId, row);
    let descText = "Transfer";
    try {
      descText = decryptTransactionPayload(userId, row.payload).description || "Transfer";
    } catch {
      /* keep default */
    }
    const fromName = row.fromAccount ? decryptFinancePlaintext(userId, row.fromAccount.name) : "From";
    const toName = row.toAccount ? decryptFinancePlaintext(userId, row.toAccount.name) : "To";
    const outSign: 1 | -1 = row.toFinancialAccountId === accountId ? 1 : -1;
    out.push({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      type: "transfer",
      title: descText,
      subtitle: `Transfer · ${fromName} → ${toName}`,
      amountCents: amt,
      currency: c,
      sign: outSign,
    });
  }

  for (const row of paymentRows) {
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
      type: "lending_payment",
      title: who,
      subtitle: `Lending payment · ${formatMoney(pay.amountCents, c)}${pay.note ? ` · ${pay.note}` : ""}`,
      amountCents: pay.amountCents,
      currency: c,
      sign,
    });
  }

  out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return out.slice(0, limit);
}

