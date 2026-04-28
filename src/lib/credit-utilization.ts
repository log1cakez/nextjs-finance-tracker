import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { accountTransfers, lendingPayments, transactions } from "@/db/schema";
import type { FiatCurrency } from "@/lib/money";
import { transferAmountCentsFromRow } from "@/lib/transfer-amount";
import { toDecryptedTransaction } from "@/lib/transaction-decrypt";
import { normalizeLendingPaymentRow, normalizeLendingRow } from "@/lib/lending-crypto";

/**
 * Outstanding balance on a credit card (minor units), for one currency.
 * Normal expenses increase balance; expenses flagged as card bill payments decrease it.
 * Other income and transfers **to** the card decrease it; transfers **from** increase it.
 * Includes `openingBalanceCents` for debt before in-app tracking.
 */
export async function computeCreditUsedCents(
  userId: string,
  financialAccountId: string,
  openingBalanceCents: number,
  limitCurrency: FiatCurrency,
): Promise<number> {
  const db = getDb();
  let used = openingBalanceCents;

  const txs = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.financialAccountId, financialAccountId),
    ),
  });
  for (const row of txs) {
    const tx = toDecryptedTransaction(userId, row);
    if (tx.currency !== limitCurrency) continue;
    if (tx.kind === "expense") {
      if (row.reducesCreditBalance) used -= tx.amountCents;
      else used += tx.amountCents;
    } else {
      used -= tx.amountCents;
    }
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
    if (t.currency !== limitCurrency) continue;
    const amt = transferAmountCentsFromRow(userId, t);
    if (t.fromFinancialAccountId === financialAccountId) {
      used += amt;
    } else {
      used -= amt;
    }
  }

  // Lending payments linked to this credit card also affect outstanding balance.
  // - Payable: you paid them (with card) -> increases used credit.
  // - Receivable: they paid you (to card) -> decreases used credit.
  const pays = await db.query.lendingPayments.findMany({
    where: eq(lendingPayments.financialAccountId, financialAccountId),
    with: { lending: true },
  });
  for (const p of pays) {
    if (!p.lending || p.lending.userId !== userId) continue;
    const loan = normalizeLendingRow(userId, p.lending);
    if (loan.currency !== limitCurrency) continue;
    const pay = normalizeLendingPaymentRow(userId, p);
    if (loan.kind === "receivable") used -= pay.amountCents;
    else used += pay.amountCents;
  }

  return used;
}
