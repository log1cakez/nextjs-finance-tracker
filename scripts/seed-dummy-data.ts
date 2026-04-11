/**
 * Insert sample categories, accounts, transactions, recurring templates, loans, EOD journal rows,
 * and (optionally) a transfer for local / staging testing. Requires an existing user (sign up first).
 *
 * Usage:
 *   SEED_USER_EMAIL=you@example.com npm run db:seed
 *
 * Re-run: set SEED_FORCE=1 (may create duplicate rows with the same "(seed)" names).
 *
 * Transfer row uses encrypted payload like production; skipped if TRANSACTIONS_ENCRYPTION_KEY is unset.
 */
import { config } from "dotenv";
import { and, eq, like, type InferInsertModel } from "drizzle-orm";
import { getDb } from "../src/db/index";
import {
  accountTransfers,
  categories,
  categoryDefinitions,
  eodTrackerRows,
  eodTradingAccounts,
  financialAccounts,
  lendingPayments,
  lendings,
  recurringExpenses,
  transactions,
  users,
} from "../src/db/schema";
import {
  encryptFinanceObject,
  encryptFinancePlaintext,
} from "../src/lib/finance-field-crypto";
import { normalizeCategoryNameKey } from "../src/lib/category-name";
import {
  persistInitialCapitalCents,
  persistTradingCents,
} from "../src/lib/eod-money-crypto";
import { encryptTransactionPayload } from "../src/lib/transaction-crypto";

config({ path: ".env.local" });
config({ path: ".env" });

const SEED_TAG = "(seed)";

function seedEncName(userId: string, plain: string): string {
  if (!process.env.TRANSACTIONS_ENCRYPTION_KEY?.trim()) {
    return plain;
  }
  return encryptFinancePlaintext(userId, plain);
}

function seedRecurringAmountFields(
  userId: string,
  fixedAmountCents: number,
  amountVariable: boolean,
): { amountCents: number | null; amountPayload: string | null } {
  if (amountVariable) {
    return { amountCents: null, amountPayload: null };
  }
  if (!process.env.TRANSACTIONS_ENCRYPTION_KEY?.trim()) {
    return { amountCents: fixedAmountCents, amountPayload: null };
  }
  return {
    amountCents: null,
    amountPayload: encryptFinanceObject(userId, {
      amountCents: fixedAmountCents,
    }),
  };
}

function txnFields(
  userId: string,
  description: string,
  amountCents: number,
):
  | { payload: string; description: null; amountCents: null }
  | { payload: null; description: string; amountCents: number } {
  const key = process.env.TRANSACTIONS_ENCRYPTION_KEY?.trim();
  if (key) {
    return {
      payload: encryptTransactionPayload(userId, { description, amountCents }),
      description: null,
      amountCents: null,
    };
  }
  return { payload: null, description, amountCents };
}

function noon(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0),
  );
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return noon(d);
}

const EOD_SEED_MARKER = "[seed-eod]";

type EodSeedSpec = {
  daysAgo: number;
  session: string;
  timeframeEof: string[];
  poi: string[];
  trend: string;
  position: string;
  riskType: string;
  result: string[];
  rrr: string;
  timeRange: string;
  entryTf: string;
  remarks: string;
  notionUrl?: string;
};

function seedNetPnlCentsForResult(result: string[]): number | null {
  if (result.includes("Win")) return 150_00;
  if (result.includes("Loss")) return -78_00;
  if (result.includes("Break Even")) return 0;
  return null;
}

function buildEodSeedRows(
  userId: string,
  tradingAccountIds: string[],
): InferInsertModel<typeof eodTrackerRows>[] {
  const specs: EodSeedSpec[] = [
    {
      daysAgo: 1,
      session: "New York",
      timeframeEof: ["M15 Bullish", "4H Bullish"],
      poi: ["LQ", "IDM"],
      trend: "Continuation",
      position: "Long",
      riskType: "Least agg.",
      result: ["Win"],
      rrr: "+20",
      timeRange: "09:30-11:15",
      entryTf: "5m",
      remarks: `Clean continuation after London sweep. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 2,
      session: "London",
      timeframeEof: ["M15 Bearish"],
      poi: ["Swept Session LQ"],
      trend: "Reversal",
      position: "Short",
      riskType: "Aggressive",
      result: ["Loss", "Data"],
      rrr: "below 10",
      timeRange: "08:00-09:30",
      entryTf: "15m",
      remarks: `Stopped early; note liquidity grab. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 4,
      session: "Asia",
      timeframeEof: ["Daily Bullish"],
      poi: ["Extreme"],
      trend: "Pro",
      position: "Long",
      riskType: "Risk Entry",
      result: ["Break Even"],
      rrr: "+10",
      timeRange: "01:00-03:00",
      entryTf: "1H",
      remarks: `Chop after news; flat. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 5,
      session: "Pre-NY",
      timeframeEof: ["M15 Wedge"],
      poi: ["Flip"],
      trend: "Wedge",
      position: "Short",
      riskType: "Least agg.",
      result: ["Win", "EOD"],
      rrr: "+30",
      timeRange: "13:00-14:30",
      entryTf: "15m",
      remarks: `Wedge resolution matched plan. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 7,
      session: "New York",
      timeframeEof: ["4H Bearish"],
      poi: ["Chain"],
      trend: "Counter",
      position: "Short",
      riskType: "Aggressive",
      result: ["Win"],
      rrr: "+40",
      timeRange: "10:00-12:00",
      entryTf: "5m",
      remarks: `Counter-trend scalp; size reduced. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 9,
      session: "London lull",
      timeframeEof: ["M15 Bearish", "Daily Bearish"],
      poi: ["LQ"],
      trend: "Continuation",
      position: "Short",
      riskType: "Least agg.",
      result: ["Data"],
      rrr: "below 10",
      timeRange: "07:30-09:00",
      entryTf: "30m",
      remarks: `No execution; observation only. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 11,
      session: "Frankfurt",
      timeframeEof: ["M15 Bullish"],
      poi: ["Sweepless Flip"],
      trend: "Scale-In",
      position: "Long",
      riskType: "Risk Entry",
      result: ["Front Run"],
      rrr: "+10",
      timeRange: "04:00-05:30",
      entryTf: "5m",
      remarks: `Front-run before target; journal for review. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 14,
      session: "New York",
      timeframeEof: ["M15 Wedge"],
      poi: ["IDM", "LQ"],
      trend: "Wedge",
      position: "Long",
      riskType: "Least agg.",
      result: ["Loss"],
      rrr: "below 10",
      timeRange: "15:00-16:00",
      entryTf: "1m",
      remarks: `Late-day fakeout; wrong context. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 16,
      session: "London",
      timeframeEof: ["4H Bullish"],
      poi: ["LQ"],
      trend: "Continuation",
      position: "Long",
      riskType: "Aggressive",
      result: ["Win"],
      rrr: "above 50",
      timeRange: "09:00-11:30",
      entryTf: "15m",
      remarks: `Strong trend day; trailed runner. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 19,
      session: "Asia",
      timeframeEof: ["Daily Bearish"],
      poi: ["Extreme", "Chain"],
      trend: "Reversal",
      position: "Short",
      riskType: "Least agg.",
      result: ["Break Even", "Data"],
      rrr: "+20",
      timeRange: "22:00-23:30",
      entryTf: "4H",
      remarks: `Reversal setup fizzled. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 22,
      session: "Pre-NY",
      timeframeEof: ["M15 Bearish"],
      poi: ["Swept Session LQ"],
      trend: "Pro",
      position: "Short",
      riskType: "Risk Entry",
      result: ["Win"],
      rrr: "+30",
      timeRange: "14:00-15:45",
      entryTf: "5m",
      remarks: `Pre-NY sweep play. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 25,
      session: "New York",
      timeframeEof: ["M15 Bullish", "M15 Wedge"],
      poi: ["Flip", "LQ"],
      trend: "Counter",
      position: "Long",
      riskType: "Aggressive",
      result: ["EOD", "Data"],
      rrr: "+10",
      timeRange: "10:30-11:00",
      entryTf: "5m",
      remarks: `End of day management only. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 28,
      session: "London",
      timeframeEof: ["4H Bearish", "Daily Bearish"],
      poi: ["LQ"],
      trend: "Continuation",
      position: "Short",
      riskType: "Least agg.",
      result: ["Win"],
      rrr: "+20",
      timeRange: "08:30-10:00",
      entryTf: "15m",
      remarks: `Aligned with higher-TF bias. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 35,
      session: "New York",
      timeframeEof: ["M15 Bullish"],
      poi: ["IDM"],
      trend: "Continuation",
      position: "Long",
      riskType: "Least agg.",
      result: ["Loss", "EOD"],
      rrr: "below 10",
      timeRange: "13:30-14:00",
      entryTf: "1m",
      remarks: `Overtraded lunch chop. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 42,
      session: "Asia",
      timeframeEof: ["M15 Bearish"],
      poi: ["Extreme"],
      trend: "Wedge",
      position: "Short",
      riskType: "Risk Entry",
      result: ["Win"],
      rrr: "+40",
      timeRange: "00:30-02:00",
      entryTf: "5m",
      remarks: `Asia range fade. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 50,
      session: "London",
      timeframeEof: ["Daily Bullish"],
      poi: ["Chain"],
      trend: "Scale-In",
      position: "Long",
      riskType: "Aggressive",
      result: ["Break Even"],
      rrr: "+10",
      timeRange: "07:00-09:30",
      entryTf: "30m",
      remarks: `Scaled in; scratched at BE. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 58,
      session: "Pre-NY",
      timeframeEof: ["M15 Wedge"],
      poi: ["LQ", "Flip"],
      trend: "Reversal",
      position: "Long",
      riskType: "Least agg.",
      result: ["Data"],
      rrr: "below 10",
      timeRange: "12:00-13:00",
      entryTf: "15m",
      remarks: `Paper only — structure practice. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 67,
      session: "New York",
      timeframeEof: ["4H Bullish", "Daily Bullish"],
      poi: ["Swept Session LQ"],
      trend: "Pro",
      position: "Long",
      riskType: "Least agg.",
      result: ["Win"],
      rrr: "+30",
      timeRange: "09:45-11:00",
      entryTf: "5m",
      remarks: `HTF alignment + session open. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 75,
      session: "Frankfurt",
      timeframeEof: ["M15 Bearish"],
      poi: ["LQ"],
      trend: "Continuation",
      position: "Short",
      riskType: "Least agg.",
      result: ["Win", "Data"],
      rrr: "+20",
      timeRange: "03:30-05:00",
      entryTf: "15m",
      remarks: `European morning trend. ${EOD_SEED_MARKER}`,
    },
    {
      daysAgo: 88,
      session: "London lull",
      timeframeEof: ["M15 Bullish"],
      poi: ["IDM"],
      trend: "Counter",
      position: "Long",
      riskType: "Risk Entry",
      result: ["Loss"],
      rrr: "below 10",
      timeRange: "06:00-07:30",
      entryTf: "5m",
      remarks: `Low volume trap. ${EOD_SEED_MARKER}`,
    },
  ];

  return specs.map((s, i) => {
    const pnl = persistTradingCents(userId, seedNetPnlCentsForResult(s.result));
    return {
    userId,
    tradeDate: daysAgo(s.daysAgo),
    tradingAccountId:
      tradingAccountIds.length > 0
        ? tradingAccountIds[i % tradingAccountIds.length]!
        : null,
    netPnlCents: pnl.netPnlCents,
    netPnlPayload: pnl.netPnlPayload,
    session: s.session,
    timeframeEofJson: JSON.stringify(s.timeframeEof),
    poiJson: JSON.stringify(s.poi),
    trend: s.trend,
    position: s.position,
    riskType: s.riskType,
    resultJson: JSON.stringify(s.result),
    rrr: s.rrr,
    timeRange: s.timeRange,
    entryTf: s.entryTf,
    remarks: s.remarks,
    notionUrl: s.notionUrl ?? "",
  };
  });
}

async function seedEodTrackerRows(
  db: ReturnType<typeof getDb>,
  userId: string,
  force: boolean,
): Promise<void> {
  if (!force) {
    const existingMarker = await db.query.eodTrackerRows.findFirst({
      where: and(
        eq(eodTrackerRows.userId, userId),
        like(eodTrackerRows.remarks, `%${EOD_SEED_MARKER}%`),
      ),
    });
    if (existingMarker) {
      console.log(
        `EOD seed rows already present (remarks contain "${EOD_SEED_MARKER}"). Set SEED_FORCE=1 to insert another batch.`,
      );
      return;
    }
  }

  let tradingAccountIds: string[] = [];
  const existingTrading = await db
    .select({ id: eodTradingAccounts.id, name: eodTradingAccounts.name })
    .from(eodTradingAccounts)
    .where(
      and(eq(eodTradingAccounts.userId, userId), like(eodTradingAccounts.name, `%${EOD_SEED_MARKER}%`)),
    );
  if (existingTrading.length >= 3) {
    tradingAccountIds = existingTrading
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => a.id);
  } else {
    try {
      const cap = persistInitialCapitalCents(userId, 100_00);
      const inserted = await db
        .insert(eodTradingAccounts)
        .values([
          { userId, name: `Seed Binance ${EOD_SEED_MARKER}`, ...cap },
          { userId, name: `Seed Bingx ${EOD_SEED_MARKER}`, ...cap },
          { userId, name: `Seed Bybit ${EOD_SEED_MARKER}`, ...cap },
        ])
        .returning({ id: eodTradingAccounts.id });
      tradingAccountIds = inserted.map((r) => r.id);
    } catch {
      console.warn(
        "Could not insert seed trading accounts (run db:migrate / db:push). EOD rows will omit broker/PnL.",
      );
    }
  }

  const rows = buildEodSeedRows(userId, tradingAccountIds);
  await db.insert(eodTrackerRows).values(rows);
  console.log(`Inserted ${rows.length} EOD tracker rows (${EOD_SEED_MARKER}).`);
}

async function main() {
  const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.error(
      "Set SEED_USER_EMAIL to your account email (e.g. in .env.local), then run again.",
    );
    process.exit(1);
  }

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });
  if (!user) {
    console.error(`No user with email "${email}". Register first, then re-run.`);
    process.exit(1);
  }

  const userId = user.id;
  const force = process.env.SEED_FORCE === "1";

  if (!force) {
    const existing = await db.query.financialAccounts.findFirst({
      where: and(
        eq(financialAccounts.userId, userId),
        like(financialAccounts.name, `%${SEED_TAG}%`),
      ),
    });
    if (existing) {
      console.log(
        `Seed data already present (account matching "${SEED_TAG}"). Set SEED_FORCE=1 to insert again.`,
      );
      await seedEodTrackerRows(db, userId, force);
      return;
    }
  }

  const [checking, savings, cashWallet] = await db
    .insert(financialAccounts)
    .values([
      {
        userId,
        name: seedEncName(userId, `Checking ${SEED_TAG}`),
        type: "bank",
        bankKind: "debit",
      },
      {
        userId,
        name: seedEncName(userId, `Savings ${SEED_TAG}`),
        type: "bank",
        bankKind: "debit",
      },
      {
        userId,
        name: seedEncName(userId, `Cash wallet ${SEED_TAG}`),
        type: "cash",
      },
    ])
    .returning({ id: financialAccounts.id });

  const catSpecs = [
    { name: `Salary ${SEED_TAG}`, kind: "income" as const },
    { name: `Freelance ${SEED_TAG}`, kind: "income" as const },
    { name: `Groceries ${SEED_TAG}`, kind: "expense" as const },
    { name: `Rent ${SEED_TAG}`, kind: "expense" as const },
    { name: `Utilities ${SEED_TAG}`, kind: "expense" as const },
    { name: `Dining ${SEED_TAG}`, kind: "expense" as const },
  ];
  const catRows: { id: string; kind: "income" | "expense" }[] = [];
  for (const spec of catSpecs) {
    const nameKey = normalizeCategoryNameKey(spec.name);
    let def = await db.query.categoryDefinitions.findFirst({
      where: and(
        eq(categoryDefinitions.nameKey, nameKey),
        eq(categoryDefinitions.kind, spec.kind),
      ),
    });
    if (!def) {
      await db
        .insert(categoryDefinitions)
        .values({
          name: spec.name,
          nameKey,
          kind: spec.kind,
        })
        .onConflictDoNothing({
          target: [categoryDefinitions.nameKey, categoryDefinitions.kind],
        });
      def = await db.query.categoryDefinitions.findFirst({
        where: and(
          eq(categoryDefinitions.nameKey, nameKey),
          eq(categoryDefinitions.kind, spec.kind),
        ),
      });
    }
    if (!def) {
      throw new Error(`Failed to resolve category definition for ${spec.name}`);
    }
    const inserted = await db
      .insert(categories)
      .values({
        userId,
        definitionId: def.id,
        name: def.name,
        kind: spec.kind,
      })
      .onConflictDoNothing({
        target: [categories.userId, categories.definitionId],
      })
      .returning({ id: categories.id, kind: categories.kind });
    const row =
      inserted[0] ??
      (await db.query.categories.findFirst({
        where: and(eq(categories.userId, userId), eq(categories.definitionId, def.id)),
        columns: { id: true, kind: true },
      }));
    if (row) catRows.push(row);
  }

  const byKind = (k: "income" | "expense") =>
    catRows.filter((c) => c.kind === k).map((c) => c.id);
  const incomeCat = byKind("income");
  const expenseCat = byKind("expense");
  const [salaryId, freelanceId] = incomeCat;
  const [groceriesId, rentId, utilitiesId, diningId] = expenseCat;

  const txSpecs: Array<{
    desc: string;
    cents: number;
    currency: "USD" | "PHP";
    kind: "income" | "expense";
    categoryId: string | null;
    accountId: string;
    daysAgo: number;
  }> = [
    {
      desc: `Payroll deposit ${SEED_TAG}`,
      cents: 4_200_00,
      currency: "USD",
      kind: "income",
      categoryId: salaryId,
      accountId: checking.id,
      daysAgo: 3,
    },
    {
      desc: `Payroll deposit ${SEED_TAG}`,
      cents: 4_200_00,
      currency: "USD",
      kind: "income",
      categoryId: salaryId,
      accountId: checking.id,
      daysAgo: 33,
    },
    {
      desc: `Contract work ${SEED_TAG}`,
      cents: 1_250_00,
      currency: "USD",
      kind: "income",
      categoryId: freelanceId,
      accountId: checking.id,
      daysAgo: 10,
    },
    {
      desc: `Client invoice paid ${SEED_TAG}`,
      cents: 85_000_00,
      currency: "PHP",
      kind: "income",
      categoryId: freelanceId,
      accountId: cashWallet.id,
      daysAgo: 18,
    },
    {
      desc: `Supermarket run ${SEED_TAG}`,
      cents: 87_45,
      currency: "USD",
      kind: "expense",
      categoryId: groceriesId,
      accountId: checking.id,
      daysAgo: 2,
    },
    {
      desc: `Weekend groceries ${SEED_TAG}`,
      cents: 112_30,
      currency: "USD",
      kind: "expense",
      categoryId: groceriesId,
      accountId: checking.id,
      daysAgo: 9,
    },
    {
      desc: `Palengke ${SEED_TAG}`,
      cents: 2_400_00,
      currency: "PHP",
      kind: "expense",
      categoryId: groceriesId,
      accountId: cashWallet.id,
      daysAgo: 5,
    },
    {
      desc: `Rent payment ${SEED_TAG}`,
      cents: 1_800_00,
      currency: "USD",
      kind: "expense",
      categoryId: rentId,
      accountId: checking.id,
      daysAgo: 7,
    },
    {
      desc: `Electric bill ${SEED_TAG}`,
      cents: 94_20,
      currency: "USD",
      kind: "expense",
      categoryId: utilitiesId,
      accountId: checking.id,
      daysAgo: 14,
    },
    {
      desc: `Internet ${SEED_TAG}`,
      cents: 79_99,
      currency: "USD",
      kind: "expense",
      categoryId: utilitiesId,
      accountId: checking.id,
      daysAgo: 21,
    },
    {
      desc: `Coffee & breakfast ${SEED_TAG}`,
      cents: 14_50,
      currency: "USD",
      kind: "expense",
      categoryId: diningId,
      accountId: cashWallet.id,
      daysAgo: 1,
    },
    {
      desc: `Dinner out ${SEED_TAG}`,
      cents: 63_75,
      currency: "USD",
      kind: "expense",
      categoryId: diningId,
      accountId: checking.id,
      daysAgo: 4,
    },
    {
      desc: `Lunch meeting ${SEED_TAG}`,
      cents: 42_00,
      currency: "USD",
      kind: "expense",
      categoryId: diningId,
      accountId: checking.id,
      daysAgo: 11,
    },
    {
      desc: `ATM withdrawal ${SEED_TAG}`,
      cents: 200_00,
      currency: "USD",
      kind: "expense",
      categoryId: null,
      accountId: checking.id,
      daysAgo: 6,
    },
    {
      desc: `Pharmacy ${SEED_TAG}`,
      cents: 28_40,
      currency: "USD",
      kind: "expense",
      categoryId: null,
      accountId: checking.id,
      daysAgo: 16,
    },
    {
      desc: `Gas station ${SEED_TAG}`,
      cents: 48_00,
      currency: "USD",
      kind: "expense",
      categoryId: null,
      accountId: checking.id,
      daysAgo: 12,
    },
    {
      desc: `Bonus deposit ${SEED_TAG}`,
      cents: 500_00,
      currency: "USD",
      kind: "income",
      categoryId: salaryId,
      accountId: savings.id,
      daysAgo: 40,
    },
    {
      desc: `Side project ${SEED_TAG}`,
      cents: 350_00,
      currency: "USD",
      kind: "income",
      categoryId: freelanceId,
      accountId: checking.id,
      daysAgo: 25,
    },
    {
      desc: `Water bill ${SEED_TAG}`,
      cents: 45_00,
      currency: "USD",
      kind: "expense",
      categoryId: utilitiesId,
      accountId: checking.id,
      daysAgo: 28,
    },
    {
      desc: `Mobile plan ${SEED_TAG}`,
      cents: 65_00,
      currency: "USD",
      kind: "expense",
      categoryId: utilitiesId,
      accountId: checking.id,
      daysAgo: 35,
    },
  ];

  const txValues = txSpecs.map((t) => {
    const p = txnFields(userId, t.desc, t.cents);
    return {
      userId,
      ...p,
      currency: t.currency,
      kind: t.kind,
      categoryId: t.categoryId,
      financialAccountId: t.accountId,
      occurredAt: daysAgo(t.daysAgo),
    };
  });

  await db.insert(transactions).values(txValues);

  await db.insert(recurringExpenses).values([
    {
      userId,
      kind: "expense",
      name: seedEncName(userId, `Streaming subs ${SEED_TAG}`),
      ...seedRecurringAmountFields(userId, 15_99, false),
      amountVariable: false,
      currency: "USD",
      categoryId: utilitiesId,
      financialAccountId: checking.id,
      frequency: "monthly",
      dueDayOfMonth: 12,
      secondDueDayOfMonth: null,
      dueWeekday: null,
    },
    {
      userId,
      kind: "expense",
      name: seedEncName(userId, `Gym membership ${SEED_TAG}`),
      ...seedRecurringAmountFields(userId, 49_99, false),
      amountVariable: false,
      currency: "USD",
      categoryId: utilitiesId,
      financialAccountId: checking.id,
      frequency: "monthly",
      dueDayOfMonth: 1,
      secondDueDayOfMonth: null,
      dueWeekday: null,
    },
    {
      userId,
      kind: "income",
      name: seedEncName(userId, `Monthly retainer ${SEED_TAG}`),
      ...seedRecurringAmountFields(userId, 2_000_00, false),
      amountVariable: false,
      currency: "USD",
      categoryId: freelanceId,
      financialAccountId: checking.id,
      frequency: "monthly",
      dueDayOfMonth: 5,
      secondDueDayOfMonth: null,
      dueWeekday: null,
    },
    {
      userId,
      kind: "expense",
      name: seedEncName(userId, `Credit card (variable) ${SEED_TAG}`),
      ...seedRecurringAmountFields(userId, 0, true),
      amountVariable: true,
      currency: "USD",
      categoryId: null,
      financialAccountId: checking.id,
      frequency: "monthly",
      dueDayOfMonth: 20,
      secondDueDayOfMonth: null,
      dueWeekday: null,
    },
  ]);

  const hasFinKey = Boolean(process.env.TRANSACTIONS_ENCRYPTION_KEY?.trim());

  const [_recvLoan, payLoan] = await db
    .insert(lendings)
    .values(
      hasFinKey
        ? [
            {
              userId,
              financePayload: encryptFinanceObject(userId, {
                counterpartyName: `Friend (receivable) ${SEED_TAG}`,
                principalCents: 350_00,
                notes: "Short-term loan; track when they repay.",
              }),
              counterpartyName: null,
              principalCents: null,
              notes: null,
              kind: "receivable" as const,
              currency: "USD" as const,
              repaymentStyle: "lump_sum" as const,
              startedAt: daysAgo(45),
            },
            {
              userId,
              financePayload: encryptFinanceObject(userId, {
                counterpartyName: `Relative (payable) ${SEED_TAG}`,
                principalCents: 1_200_00,
                notes: "Paying back in parts.",
              }),
              counterpartyName: null,
              principalCents: null,
              notes: null,
              kind: "payable" as const,
              currency: "USD" as const,
              repaymentStyle: "installment" as const,
              startedAt: daysAgo(90),
            },
          ]
        : [
            {
              userId,
              counterpartyName: `Friend (receivable) ${SEED_TAG}`,
              kind: "receivable",
              principalCents: 350_00,
              currency: "USD",
              repaymentStyle: "lump_sum",
              startedAt: daysAgo(45),
              notes: "Short-term loan; track when they repay.",
            },
            {
              userId,
              counterpartyName: `Relative (payable) ${SEED_TAG}`,
              kind: "payable",
              principalCents: 1_200_00,
              currency: "USD",
              repaymentStyle: "installment",
              startedAt: daysAgo(90),
              notes: "Paying back in parts.",
            },
          ],
    )
    .returning({ id: lendings.id });

  if (hasFinKey) {
    await db.insert(lendingPayments).values({
      lendingId: payLoan.id,
      financePayload: encryptFinanceObject(userId, {
        amountCents: 250_00,
        note: "Installment 1",
      }),
      amountCents: null,
      note: null,
      paidAt: daysAgo(14),
    });
  } else {
    await db.insert(lendingPayments).values({
      lendingId: payLoan.id,
      amountCents: 250_00,
      paidAt: daysAgo(14),
      note: "Installment 1",
    });
  }

  if (process.env.TRANSACTIONS_ENCRYPTION_KEY?.trim()) {
    const transferPayload = encryptTransactionPayload(userId, {
      description: `Transfer: Checking ${SEED_TAG} → Savings ${SEED_TAG}`,
      amountCents: 500_00,
    });
    await db.insert(accountTransfers).values({
      userId,
      fromFinancialAccountId: checking.id,
      toFinancialAccountId: savings.id,
      amountCents: null,
      currency: "USD",
      payload: transferPayload,
      occurredAt: daysAgo(8),
    });
    console.log("Inserted sample account transfer (encrypted).");
  } else {
    console.log(
      "Skipped sample transfer (set TRANSACTIONS_ENCRYPTION_KEY to seed a transfer row).",
    );
  }

  await seedEodTrackerRows(db, userId, force);

  console.log(
    `Done. Seeded user ${email}: ${catRows.length} categories, 3 accounts, ${txValues.length} transactions, 4 recurring templates, 2 loans (receivable + payable with one payment), plus EOD journal rows (see remarks ${EOD_SEED_MARKER}).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
