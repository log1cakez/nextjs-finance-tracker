/**
 * One-time: encrypt legacy financial account numeric/schedule fields into finance_payload.
 * Requires DATABASE_URL and TRANSACTIONS_ENCRYPTION_KEY.
 *
 * Run: npm run db:encrypt-accounts
 */
import { config } from "dotenv";
import { eq, isNull, or, isNotNull } from "drizzle-orm";
import { getDb } from "../src/db/index";
import { financialAccounts } from "../src/db/schema";
import { encryptFinancialAccountPayload } from "../src/lib/financial-account-crypto";
import type { FiatCurrency } from "../src/lib/money";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const db = getDb();
  const rows = await db
    .select()
    .from(financialAccounts)
    .where(
      or(
        isNull(financialAccounts.financePayload),
        isNotNull(financialAccounts.creditLimitCents),
        isNotNull(financialAccounts.creditLimitCurrency),
        isNotNull(financialAccounts.creditStatementDayOfMonth),
        isNotNull(financialAccounts.creditPaymentDueDayOfMonth),
        isNotNull(financialAccounts.openingBalanceCents),
        isNotNull(financialAccounts.openingBalanceCurrency),
      ),
    );

  if (rows.length === 0) {
    console.log("No legacy account rows to encrypt.");
    return;
  }

  console.log(`Encrypting ${rows.length} financial account row(s)...`);
  for (const row of rows) {
    const payload = encryptFinancialAccountPayload(row.userId, {
      creditLimitCents: row.creditLimitCents ?? null,
      creditLimitCurrency:
        (row.creditLimitCurrency as FiatCurrency | null) ?? null,
      creditOpeningBalanceCents: row.creditOpeningBalanceCents ?? 0,
      creditStatementDayOfMonth: row.creditStatementDayOfMonth ?? null,
      creditPaymentDueDayOfMonth: row.creditPaymentDueDayOfMonth ?? null,
      openingBalanceCents: row.openingBalanceCents ?? null,
      openingBalanceCurrency:
        (row.openingBalanceCurrency as FiatCurrency | null) ?? null,
    });

    await db
      .update(financialAccounts)
      .set({
        financePayload: payload,
        creditLimitCents: null,
        creditLimitCurrency: null,
        creditOpeningBalanceCents: 0,
        creditStatementDayOfMonth: null,
        creditPaymentDueDayOfMonth: null,
        openingBalanceCents: null,
        openingBalanceCurrency: null,
      })
      .where(eq(financialAccounts.id, row.id));
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

