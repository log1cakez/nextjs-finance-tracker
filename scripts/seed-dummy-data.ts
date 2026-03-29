/**
 * Insert sample categories, accounts, transactions, recurring templates, loans, and (optionally) a transfer
 * for local / staging testing. Requires an existing user (sign up first).
 *
 * Usage:
 *   SEED_USER_EMAIL=you@example.com npm run db:seed
 *
 * Re-run: set SEED_FORCE=1 (may create duplicate rows with the same "(seed)" names).
 *
 * Transfer row uses encrypted payload like production; skipped if TRANSACTIONS_ENCRYPTION_KEY is unset.
 */
import { config } from "dotenv";
import { and, eq, like } from "drizzle-orm";
import { getDb } from "../src/db/index";
import {
  accountTransfers,
  categories,
  financialAccounts,
  lendingPayments,
  lendings,
  recurringExpenses,
  transactions,
  users,
} from "../src/db/schema";
import { encryptTransactionPayload } from "../src/lib/transaction-crypto";

config({ path: ".env.local" });
config({ path: ".env" });

const SEED_TAG = "(seed)";

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
      return;
    }
  }

  const [checking, savings, cashWallet] = await db
    .insert(financialAccounts)
    .values([
      {
        userId,
        name: `Checking ${SEED_TAG}`,
        type: "bank",
      },
      {
        userId,
        name: `Savings ${SEED_TAG}`,
        type: "bank",
      },
      {
        userId,
        name: `Cash wallet ${SEED_TAG}`,
        type: "cash",
      },
    ])
    .returning({ id: financialAccounts.id });

  const catRows = await db
    .insert(categories)
    .values([
      { userId, name: `Salary ${SEED_TAG}`, kind: "income" },
      { userId, name: `Freelance ${SEED_TAG}`, kind: "income" },
      { userId, name: `Groceries ${SEED_TAG}`, kind: "expense" },
      { userId, name: `Rent ${SEED_TAG}`, kind: "expense" },
      { userId, name: `Utilities ${SEED_TAG}`, kind: "expense" },
      { userId, name: `Dining ${SEED_TAG}`, kind: "expense" },
    ])
    .returning({ id: categories.id, kind: categories.kind });

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
      name: `Streaming subs ${SEED_TAG}`,
      amountCents: 15_99,
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
      name: `Gym membership ${SEED_TAG}`,
      amountCents: 49_99,
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
      name: `Monthly retainer ${SEED_TAG}`,
      amountCents: 2_000_00,
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
      name: `Credit card (variable) ${SEED_TAG}`,
      amountCents: null,
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

  const [_recvLoan, payLoan] = await db
    .insert(lendings)
    .values([
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
    ])
    .returning({ id: lendings.id });

  await db.insert(lendingPayments).values({
    lendingId: payLoan.id,
    amountCents: 250_00,
    paidAt: daysAgo(14),
    note: "Installment 1",
  });

  if (process.env.TRANSACTIONS_ENCRYPTION_KEY?.trim()) {
    const transferPayload = encryptTransactionPayload(userId, {
      description: `Transfer: Checking ${SEED_TAG} → Savings ${SEED_TAG}`,
      amountCents: 500_00,
    });
    await db.insert(accountTransfers).values({
      userId,
      fromFinancialAccountId: checking.id,
      toFinancialAccountId: savings.id,
      amountCents: 500_00,
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

  console.log(
    `Done. Seeded user ${email}: ${catRows.length} categories, 3 accounts, ${txValues.length} transactions, 4 recurring templates, 2 loans (receivable + payable with one payment).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
