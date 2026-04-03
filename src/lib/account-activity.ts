import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { accountTransfers, lendingPayments, lendings, transactions } from "@/db/schema";
import type { FiatCurrency } from "@/lib/money";
import { transferAmountCentsFromRow } from "@/lib/transfer-amount";
import { toDecryptedTransaction } from "@/lib/transaction-decrypt";
import { normalizeLendingPaymentRow, normalizeLendingRow } from "@/lib/lending-crypto";

/**
 * Net change from recorded activity on a bank-style account in one currency
 * (income − expenses, plus transfers in − transfers out, plus lending payments linked
 * to this account). Matches how recurring logs post: they create transactions on this
 * account and therefore affect this sum.
 */
export async function computeAccountNetActivityCents(
  userId: string,
  financialAccountId: string,
  currency: FiatCurrency,
): Promise<number> {
  const db = getDb();
  let net = 0;

  const txs = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.financialAccountId, financialAccountId),
    ),
  });
  for (const row of txs) {
    const tx = toDecryptedTransaction(userId, row);
    if (tx.currency !== currency) continue;
    if (tx.kind === "income") net += tx.amountCents;
    else if (row.reducesCreditBalance) net += tx.amountCents;
    else net -= tx.amountCents;
  }

  const transfers = await db.query.accountTransfers.findMany({
    where: and(
      eq(accountTransfers.userId, userId),
      or(
        eq(accountTransfers.fromFinancialAccountId, financialAccountId),
        eq(accountTransfers.toFinancialAccountId, financialAccountId),
      ),
    ),
  });
  for (const t of transfers) {
    if (t.currency !== currency) continue;
    const amt = transferAmountCentsFromRow(userId, t);
    if (t.fromFinancialAccountId === financialAccountId) net -= amt;
    else net += amt;
  }

  // Lending payments linked to this account behave like cashflow.
  // - Receivable: they paid you -> increases account net.
  // - Payable: you paid them -> decreases account net.
  const pays = await db.query.lendingPayments.findMany({
    where: eq(lendingPayments.financialAccountId, financialAccountId),
    with: { lending: true },
  });
  for (const p of pays) {
    if (!p.lending || p.lending.userId !== userId) continue;
    const loan = normalizeLendingRow(userId, p.lending);
    if (loan.currency !== currency) continue;
    const pay = normalizeLendingPaymentRow(userId, p);
    if (loan.kind === "receivable") net += pay.amountCents;
    else net -= pay.amountCents;
  }

  return net;
}
