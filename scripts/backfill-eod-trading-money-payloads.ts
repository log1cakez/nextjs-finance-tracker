/**
 * Move legacy cleartext `initial_capital_cents` / `net_pnl_cents` into encrypted payload columns
 * (same key as finance: TRANSACTIONS_ENCRYPTION_KEY). Run after `0028_eod_trading_money_payload` migration.
 *
 *   npm run db:encrypt-eod-trading-money
 */
import { config } from "dotenv";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../src/db/index";
import { eodTrackerRows, eodTradingAccounts } from "../src/db/schema";
import {
  persistInitialCapitalCents,
  persistTradingCents,
  tradingMoneyEncryptionConfigured,
} from "../src/lib/eod-money-crypto";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  if (!tradingMoneyEncryptionConfigured()) {
    console.error(
      "TRANSACTIONS_ENCRYPTION_KEY must be set (same as finance). Generate with: openssl rand -hex 32",
    );
    process.exit(1);
  }

  const db = getDb();

  const accounts = await db
    .select()
    .from(eodTradingAccounts)
    .where(isNull(eodTradingAccounts.initialCapitalPayload));

  let ac = 0;
  for (const a of accounts) {
    const cents = a.initialCapitalCents ?? 0;
    const cap = persistInitialCapitalCents(a.userId, cents);
    await db
      .update(eodTradingAccounts)
      .set({
        initialCapitalPayload: cap.initialCapitalPayload,
        initialCapitalCents: cap.initialCapitalCents,
      })
      .where(eq(eodTradingAccounts.id, a.id));
    ac += 1;
  }
  console.log(`Updated ${ac} trading account(s) with encrypted initial capital.`);

  const rows = await db
    .select()
    .from(eodTrackerRows)
    .where(and(isNull(eodTrackerRows.netPnlPayload), isNotNull(eodTrackerRows.netPnlCents)));

  let rc = 0;
  for (const r of rows) {
    const pnl = persistTradingCents(r.userId, r.netPnlCents);
    await db
      .update(eodTrackerRows)
      .set({
        netPnlPayload: pnl.netPnlPayload,
        netPnlCents: pnl.netPnlCents,
      })
      .where(eq(eodTrackerRows.id, r.id));
    rc += 1;
  }
  console.log(`Updated ${rc} EOD row(s) with encrypted net P&L.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
