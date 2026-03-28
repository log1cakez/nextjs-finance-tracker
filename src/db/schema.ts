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
  "other",
]);

export const recurringFrequency = pgEnum("recurring_frequency", [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "quarterly",
  "yearly",
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

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: transactionKind("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** User-defined accounts: banks, crypto, forex, business, etc. (not OAuth.) */
export const financialAccounts = pgTable("financial_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: financialAccountType("type").notNull(),
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
  amountCents: integer("amount_cents").notNull(),
  currency: transactionCurrency("currency").notNull().default("USD"),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  financialAccountId: uuid("financial_account_id")
    .notNull()
    .references(() => financialAccounts.id, { onDelete: "restrict" }),
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
  amountCents: integer("amount_cents").notNull(),
  currency: transactionCurrency("currency").notNull().default("USD"),
  payload: text("payload").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
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

export const schema = {
  users,
  accounts,
  sessions,
  verificationTokens,
  passwordResetOtps,
  authenticators,
  categories,
  financialAccounts,
  recurringExpenses,
  accountTransfers,
  transactions,
  usersRelations,
  accountsRelations,
  sessionsRelations,
  authenticatorsRelations,
  categoriesRelations,
  financialAccountsRelations,
  recurringExpensesRelations,
  accountTransfersRelations,
  transactionsRelations,
};
