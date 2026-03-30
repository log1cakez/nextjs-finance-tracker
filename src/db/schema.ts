import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "@auth/core/adapters";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const transactionKind = pgEnum("transaction_kind", ["income", "expense"]);

export const transactionCurrency = pgEnum("transaction_currency", ["USD", "PHP"]);

export const financialAccountType = pgEnum("financial_account_type", [
  "bank",
  "crypto",
  "forex",
  "business",
  "cash",
  "ewallet",
  "other",
]);

/** Bank accounts only: checking/debit vs credit card. */
export const bankAccountKind = pgEnum("bank_account_kind", ["debit", "credit"]);

export const recurringFrequency = pgEnum("recurring_frequency", [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "quarterly",
  "yearly",
]);

/** Receivable = someone borrowed from you; payable = you borrowed from someone. */
export const lendingKind = pgEnum("lending_kind", ["receivable", "payable"]);

export const lendingRepaymentStyle = pgEnum("lending_repayment_style", [
  "lump_sum",
  "installment",
]);

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  /** SHA-256 hex of secret token for optional iCal-style due-date feed. */
  calendarFeedTokenHash: text("calendar_feed_token_hash"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({
      columns: [vt.identifier, vt.token],
    }),
  }),
);

/** Email OTP for password reset (hashed code). */
export const passwordResetOtps = pgTable("password_reset_otp", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => ({
    compositePK: primaryKey({
      columns: [authenticator.userId, authenticator.credentialID],
    }),
  }),
);

/**
 * Shared category labels (one row per normalized name + kind). User rows in `categories`
 * reference a definition so identical names across users reuse the same definition.
 */
export const categoryDefinitions = pgTable(
  "category_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Display label (canonical casing from first creator or adopter). */
    name: text("name").notNull(),
    /** `lower(trim(name))` with collapsed spaces — unique with `kind`. */
    nameKey: text("name_key").notNull(),
    kind: transactionKind("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameKeyKindUq: uniqueIndex("category_definitions_name_key_kind").on(t.nameKey, t.kind),
  }),
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => categoryDefinitions.id, { onDelete: "restrict" }),
    /** Denormalized from the definition for queries and display. */
    name: text("name").notNull(),
    kind: transactionKind("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userDefinitionUq: uniqueIndex("categories_user_definition_idx").on(
      t.userId,
      t.definitionId,
    ),
  }),
);

/** User-defined accounts: banks, crypto, forex, business, etc. (not OAuth.) */
export const financialAccounts = pgTable("financial_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: financialAccountType("type").notNull(),
  /** Set when `type` is `bank`; null for other account types. */
  bankKind: bankAccountKind("bank_kind"),
  /** Encrypted JSON for sensitive account financial fields. */
  financePayload: text("finance_payload"),
  /** Credit limit (minor units); only when `bankKind` is `credit`. */
  creditLimitCents: integer("credit_limit_cents"),
  /** Currency for limit and utilization (transactions in other currencies are ignored). */
  creditLimitCurrency: transactionCurrency("credit_limit_currency"),
  /** Balance owed before tracking in this app (same currency as limit). */
  creditOpeningBalanceCents: integer("credit_opening_balance_cents")
    .notNull()
    .default(0),
  /** Billing cycle statement close day (1–31); credit accounts only. */
  creditStatementDayOfMonth: integer("credit_statement_day_of_month"),
  /** Payment due day of month (1–31); credit accounts only. */
  creditPaymentDueDayOfMonth: integer("credit_payment_due_day_of_month"),
  /**
   * Cash held when you started tracking (debit bank, e-wallet, crypto, etc.).
   * Not used for credit cards (use credit opening balance owed instead).
   */
  openingBalanceCents: integer("opening_balance_cents"),
  openingBalanceCurrency: transactionCurrency("opening_balance_currency"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Recurring income or expense templates; log to create a real transaction.
 * (Table name remains `recurring_expenses` for existing databases.)
 */
export const recurringExpenses = pgTable("recurring_expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: transactionKind("kind").notNull().default("expense"),
  name: text("name").notNull(),
  /** Null when `amountVariable` is true (e.g. credit card — amount entered when logging). */
  amountCents: integer("amount_cents"),
  /** Encrypted JSON `{ amountCents }` for fixed templates; when set, `amount_cents` is null. */
  amountPayload: text("amount_payload"),
  amountVariable: boolean("amount_variable").notNull().default(false),
  currency: transactionCurrency("currency").notNull().default("USD"),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  financialAccountId: uuid("financial_account_id")
    .notNull()
    .references(() => financialAccounts.id, { onDelete: "restrict" }),
  /** Expense on credit card: logs reduce balance owed (payment), not a new charge. */
  creditPaydown: boolean("credit_paydown").notNull().default(false),
  frequency: recurringFrequency("frequency").notNull(),
  dueDayOfMonth: integer("due_day_of_month"),
  /** Second calendar day for `semimonthly` (e.g. second pay run); null otherwise. */
  secondDueDayOfMonth: integer("second_due_day_of_month"),
  dueWeekday: integer("due_weekday"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Move funds between two of your accounts (not counted as income/expense). */
export const accountTransfers = pgTable("account_transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fromFinancialAccountId: uuid("from_financial_account_id")
    .notNull()
    .references(() => financialAccounts.id, { onDelete: "restrict" }),
  toFinancialAccountId: uuid("to_financial_account_id")
    .notNull()
    .references(() => financialAccounts.id, { onDelete: "restrict" }),
  /** Null for new rows; amount lives only in encrypted `payload`. Legacy rows may still set this. */
  amountCents: integer("amount_cents"),
  currency: transactionCurrency("currency").notNull().default("USD"),
  payload: text("payload").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Personal loans / IOUs: receivables (owed to you) and payables (you owe).
 * Payments reduce the outstanding balance (lump sum or recorded installments).
 */
export const lendings = pgTable("lendings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /**
   * Encrypted JSON at rest (`encryptFinanceObject`): counterpartyName, principalCents, notes.
   * When set, legacy plaintext columns are null.
   */
  financePayload: text("finance_payload"),
  /** Legacy plaintext; prefer `financePayload` for new rows. */
  counterpartyName: text("counterparty_name"),
  kind: lendingKind("kind").notNull(),
  /** Legacy plaintext principal; null when using `financePayload`. */
  principalCents: integer("principal_cents"),
  currency: transactionCurrency("currency").notNull().default("USD"),
  repaymentStyle: lendingRepaymentStyle("repayment_style")
    .notNull()
    .default("lump_sum"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const lendingPayments = pgTable("lending_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  lendingId: uuid("lending_id")
    .notNull()
    .references(() => lendings.id, { onDelete: "cascade" }),
  /** Optional: which of your accounts this payment affected. */
  financialAccountId: uuid("financial_account_id").references(
    () => financialAccounts.id,
    { onDelete: "set null" },
  ),
  /** Encrypted JSON: amountCents, note. When set, legacy amount/note are null. */
  financePayload: text("finance_payload"),
  amountCents: integer("amount_cents"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** App-level FX cache for balance conversion (USD -> PHP). */
export const appFxRates = pgTable("app_fx_rates", {
  id: text("id").primaryKey(), // use fixed key "usd_php"
  usdToPhpRatePpm: integer("usd_to_php_rate_ppm").notNull(), // parts-per-million
  source: text("source").notNull().default("manual"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Legacy plaintext; null once migrated to `payload`. */
  description: text("description"),
  amountCents: integer("amount_cents"),
  /** AES-256-GCM ciphertext (description + amount). Preferred when set. */
  payload: text("payload"),
  currency: transactionCurrency("currency").notNull().default("USD"),
  kind: transactionKind("kind").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  financialAccountId: uuid("financial_account_id").references(
    () => financialAccounts.id,
    { onDelete: "restrict" },
  ),
  /**
   * When true (expense on a credit card): reduces utilization / balance owed
   * (bill payment), instead of increasing it like a purchase.
   */
  reducesCreditBalance: boolean("reduces_credit_balance").notNull().default(false),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  authenticators: many(authenticators),
  categories: many(categories),
  financeAccounts: many(financialAccounts),
  recurringExpenses: many(recurringExpenses),
  accountTransfers: many(accountTransfers),
  transactions: many(transactions),
  lendings: many(lendings),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const authenticatorsRelations = relations(authenticators, ({ one }) => ({
  user: one(users, { fields: [authenticators.userId], references: [users.id] }),
}));

export const categoryDefinitionsRelations = relations(
  categoryDefinitions,
  ({ many }) => ({
    categories: many(categories),
  }),
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  definition: one(categoryDefinitions, {
    fields: [categories.definitionId],
    references: [categoryDefinitions.id],
  }),
  transactions: many(transactions),
  recurringExpenses: many(recurringExpenses),
}));

export const financialAccountsRelations = relations(
  financialAccounts,
  ({ one, many }) => ({
    user: one(users, {
      fields: [financialAccounts.userId],
      references: [users.id],
    }),
    transactions: many(transactions),
    recurringExpenses: many(recurringExpenses),
    transfersOut: many(accountTransfers, { relationName: "accountTransferOut" }),
    transfersIn: many(accountTransfers, { relationName: "accountTransferIn" }),
  }),
);

export const recurringExpensesRelations = relations(
  recurringExpenses,
  ({ one }) => ({
    user: one(users, {
      fields: [recurringExpenses.userId],
      references: [users.id],
    }),
    category: one(categories, {
      fields: [recurringExpenses.categoryId],
      references: [categories.id],
    }),
    financialAccount: one(financialAccounts, {
      fields: [recurringExpenses.financialAccountId],
      references: [financialAccounts.id],
    }),
  }),
);

export const accountTransfersRelations = relations(
  accountTransfers,
  ({ one }) => ({
    user: one(users, {
      fields: [accountTransfers.userId],
      references: [users.id],
    }),
    fromAccount: one(financialAccounts, {
      fields: [accountTransfers.fromFinancialAccountId],
      references: [financialAccounts.id],
      relationName: "accountTransferOut",
    }),
    toAccount: one(financialAccounts, {
      fields: [accountTransfers.toFinancialAccountId],
      references: [financialAccounts.id],
      relationName: "accountTransferIn",
    }),
  }),
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  financialAccount: one(financialAccounts, {
    fields: [transactions.financialAccountId],
    references: [financialAccounts.id],
  }),
}));

export const lendingsRelations = relations(lendings, ({ one, many }) => ({
  user: one(users, {
    fields: [lendings.userId],
    references: [users.id],
  }),
  payments: many(lendingPayments),
}));

export const lendingPaymentsRelations = relations(lendingPayments, ({ one }) => ({
  lending: one(lendings, {
    fields: [lendingPayments.lendingId],
    references: [lendings.id],
  }),
}));

export const schema = {
  users,
  accounts,
  sessions,
  verificationTokens,
  passwordResetOtps,
  authenticators,
  categories,
  categoryDefinitions,
  financialAccounts,
  recurringExpenses,
  accountTransfers,
  lendings,
  lendingPayments,
  appFxRates,
  transactions,
  usersRelations,
  accountsRelations,
  sessionsRelations,
  authenticatorsRelations,
  categoriesRelations,
  categoryDefinitionsRelations,
  financialAccountsRelations,
  recurringExpensesRelations,
  accountTransfersRelations,
  lendingsRelations,
  lendingPaymentsRelations,
  transactionsRelations,
};
