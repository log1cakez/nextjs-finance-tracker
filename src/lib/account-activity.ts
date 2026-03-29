import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { accountTransfers, transactions } from "@/db/schema";
import type { FiatCurrency } from "@/lib/money";
import { transferAmountCentsFromRow } from "@/lib/transfer-amount";
import { toDecryptedTransaction } from "@/lib/transaction-decrypt";

/**
 * Net change from recorded activity on a bank-style account in one currency
 * (income − expenses, plus transfers in − transfers out). Matches how recurring
 * logs post: they create transactions on this account and therefore affect this sum.
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

  return net;
}
