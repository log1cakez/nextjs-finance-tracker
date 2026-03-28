/**
 * One-time: encrypt legacy plaintext transactions (description + amount_cents).
 * Requires DATABASE_URL and TRANSACTIONS_ENCRYPTION_KEY in .env.local
 *
 * Run: npm run db:encrypt-transactions
 */
import { config } from "dotenv";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../src/db/index";
import { transactions } from "../src/db/schema";
import { encryptTransactionPayload } from "../src/lib/transaction-crypto";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const db = getDb();
  const legacy = await db
    .select()
    .from(transactions)
    .where(
      and(
        isNull(transactions.payload),
        isNotNull(transactions.description),
        isNotNull(transactions.amountCents),
      ),
    );

  if (legacy.length === 0) {
    console.log("No legacy rows to encrypt.");
    return;
  }

  console.log(`Encrypting ${legacy.length} transaction(s)...`);

  for (const row of legacy) {
    const payload = encryptTransactionPayload(row.userId, {
      description: row.description!,
      amountCents: row.amountCents!,
    });
    await db
      .update(transactions)
      .set({
        payload,
        description: null,
        amountCents: null,
      })
      .where(eq(transactions.id, row.id));
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
