import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { accountTransfers, transactions } from "@/db/schema";
import type { FiatCurrency } from "@/lib/money";
import { toDecryptedTransaction } from "@/lib/transaction-decrypt";

/**
 * Outstanding balance on a credit card (minor units), for one currency.
 * Expenses increase balance; income and transfers **to** the card decrease it.
 * Transfers **from** the card increase it (e.g. cash advance).
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
    if (tx.kind === "expense") used += tx.amountCents;
    else used -= tx.amountCents;
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
    if (t.fromFinancialAccountId === financialAccountId) {
      used += t.amountCents;
    } else {
      used -= t.amountCents;
    }
  }

  return used;
}
