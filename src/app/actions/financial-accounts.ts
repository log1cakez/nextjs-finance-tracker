"use server";

import { and, asc, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  accountTransfers,
  financialAccounts,
  recurringExpenses,
  transactions,
} from "@/db/schema";
import { computeCreditUsedCents } from "@/lib/credit-utilization";
import {
  decryptFinancePlaintext,
  encryptFinancePlaintext,
} from "@/lib/finance-field-crypto";
import { FINANCE_ACCOUNT_TYPES } from "@/lib/financial-account-labels";
import {
  parseAmountToMinor,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import { computeAccountNetActivityCents } from "@/lib/account-activity";
import { getPreferredCurrency } from "@/lib/preferences";
import { formatTypedLabel } from "@/lib/typed-label-format";
import { getSessionUserId } from "@/lib/session";

const typeSchema = z.enum(FINANCE_ACCOUNT_TYPES);
const bankKindSchema = z.enum(["debit", "credit"]);

function collectDbErrorText(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 8 && cur; i++) {
    if (cur instanceof Error) {
      parts.push(cur.message);
      cur = cur.cause;
    } else if (
      typeof cur === "object" &&
      cur !== null &&
      "message" in cur &&
      typeof (cur as { message: unknown }).message === "string"
    ) {
      parts.push((cur as { message: string }).message);
      cur =
        "cause" in cur ? (cur as { cause: unknown }).cause : undefined;
    } else {
      break;
    }
  }
  return parts.join("\n");
}

function isMissingEwalletEnumError(err: unknown): boolean {
  const text = collectDbErrorText(err).toLowerCase();
  return (
    text.includes("ewallet") &&
    (text.includes("financial_account_type") ||
      text.includes("invalid input value for enum"))
  );
}

function parseOptionalDayOfMonth(
  raw: string | undefined,
  label: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = raw?.trim() ?? "";
  if (t.length === 0) return { ok: true, value: null };
  const n = Number.parseInt(t, 10);
  if (!Number.isInteger(n) || n < 1 || n > 31) {
    return {
      ok: false,
      message: `${label} must be a day of month from 1 to 31 (or leave blank)`,
    };
  }
  return { ok: true, value: n };
}

export type FinancialAccountActionState = {
  error?: string;
  success?: boolean;
};

export type UpdateCreditActionState = FinancialAccountActionState;

const createSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(120),
    type: typeSchema,
    bankKind: z.string().optional(),
    creditLimit: z.string().optional(),
    creditOpening: z.string().optional(),
    creditLimitCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
    creditStatementDay: z.string().optional(),
    creditPaymentDueDay: z.string().optional(),
    heldAmount: z.string().optional(),
    heldCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "bank") {
      const bk = bankKindSchema.safeParse(data.bankKind);
      if (!bk.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Choose debit or credit for this bank account",
          path: ["bankKind"],
        });
        return;
      }
      if (bk.data === "credit") {
        const lim = parseAmountToMinor(data.creditLimit?.trim() ?? "");
        if (lim === null || lim <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Enter a positive credit limit",
            path: ["creditLimit"],
          });
        }
        if (
          !data.creditLimitCurrency ||
          !SUPPORTED_CURRENCIES.includes(data.creditLimitCurrency)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Pick a currency for the credit limit",
            path: ["creditLimitCurrency"],
          });
        }
        const st = parseOptionalDayOfMonth(
          data.creditStatementDay,
          "Statement date",
        );
        if (!st.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: st.message,
            path: ["creditStatementDay"],
          });
        }
        const pd = parseOptionalDayOfMonth(
          data.creditPaymentDueDay,
          "Payment due date",
        );
        if (!pd.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: pd.message,
            path: ["creditPaymentDueDay"],
          });
        }
      }
    }

    const isCreditCard = data.type === "bank" && data.bankKind === "credit";
    if (!isCreditCard) {
      const heldRaw = data.heldAmount?.trim() ?? "";
      if (heldRaw.length > 0) {
        const h = parseAmountToMinor(heldRaw);
        if (h === null || h < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Enter a valid starting balance (zero or more)",
            path: ["heldAmount"],
          });
        }
        if (
          !data.heldCurrency ||
          !SUPPORTED_CURRENCIES.includes(data.heldCurrency)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Pick a currency for the starting balance",
            path: ["heldCurrency"],
          });
        }
      }
    }
  });

export async function createFinancialAccount(
  _prev: FinancialAccountActionState,
  formData: FormData,
): Promise<FinancialAccountActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    bankKind: formData.get("bankKind") ?? undefined,
    creditLimit: formData.get("creditLimit") ?? undefined,
    creditOpening: formData.get("creditOpening") ?? undefined,
    creditLimitCurrency: formData.get("creditLimitCurrency") ?? undefined,
    creditStatementDay: formData.get("creditStatementDay") ?? undefined,
    creditPaymentDueDay: formData.get("creditPaymentDueDay") ?? undefined,
    heldAmount: formData.get("heldAmount") ?? undefined,
    heldCurrency: formData.get("heldCurrency") ?? undefined,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const name = formatTypedLabel(parsed.data.name.trim());
  if (!name) {
    return { error: "Name is required" };
  }
  const { type } = parsed.data;

  let bankKind: "debit" | "credit" | null = null;
  let creditLimitCents: number | null = null;
  let creditLimitCurrency: FiatCurrency | null = null;
  let creditOpeningBalanceCents = 0;
  let creditStatementDayOfMonth: number | null = null;
  let creditPaymentDueDayOfMonth: number | null = null;

  if (type === "bank") {
    const bk = bankKindSchema.parse(parsed.data.bankKind);
    bankKind = bk;
    if (bk === "credit") {
      creditLimitCents = parseAmountToMinor(parsed.data.creditLimit!.trim())!;
      creditLimitCurrency = parsed.data.creditLimitCurrency!;
      const openRaw = parsed.data.creditOpening?.trim() ?? "";
      if (openRaw.length > 0) {
        const o = parseAmountToMinor(openRaw);
        if (o === null) {
          return { error: "Enter a valid starting balance owed (or leave blank)" };
        }
        creditOpeningBalanceCents = o;
      }
      const st = parseOptionalDayOfMonth(
        parsed.data.creditStatementDay,
        "Statement date",
      );
      const pd = parseOptionalDayOfMonth(
        parsed.data.creditPaymentDueDay,
        "Payment due date",
      );
      if (!st.ok) {
        return { error: st.message };
      }
      if (!pd.ok) {
        return { error: pd.message };
      }
      creditStatementDayOfMonth = st.value;
      creditPaymentDueDayOfMonth = pd.value;
    }
  }

  let openingBalanceCents: number | null = null;
  let openingBalanceCurrency: FiatCurrency | null = null;
  const isCreditCard = type === "bank" && bankKind === "credit";
  if (!isCreditCard) {
    const heldRaw = parsed.data.heldAmount?.trim() ?? "";
    if (heldRaw.length > 0) {
      const h = parseAmountToMinor(heldRaw);
      if (h === null || h < 0) {
        return { error: "Enter a valid starting balance (zero or more)" };
      }
      const hcur = parsed.data.heldCurrency;
      if (!hcur || !SUPPORTED_CURRENCIES.includes(hcur)) {
        return { error: "Pick a currency for the starting balance" };
      }
      openingBalanceCents = h;
      openingBalanceCurrency = hcur;
    }
  }

  let encName: string;
  try {
    encName = encryptFinancePlaintext(userId, name.trim());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
      return {
        error:
          "Set TRANSACTIONS_ENCRYPTION_KEY (e.g. openssl rand -hex 32) to store account names encrypted.",
      };
    }
    return { error: "Could not encrypt account name. Try again." };
  }

  try {
    await getDb().insert(financialAccounts).values({
      userId,
      name: encName,
      type,
      bankKind,
      creditLimitCents,
      creditLimitCurrency,
      creditOpeningBalanceCents,
      creditStatementDayOfMonth,
      creditPaymentDueDayOfMonth,
      openingBalanceCents,
      openingBalanceCurrency,
    });
  } catch (err: unknown) {
    if (isMissingEwalletEnumError(err)) {
      return {
        error:
          "This database is missing the E-wallet account type. Run npm run db:migrate (or apply migration `0012_financial_account_ewallet.sql`). In Neon’s SQL editor you can run: ALTER TYPE \"financial_account_type\" ADD VALUE IF NOT EXISTS 'ewallet';",
      };
    }
    throw err;
  }

  revalidatePath("/accounts");
  revalidatePath("/", "layout");
  revalidatePath("/transactions");
  revalidatePath("/recurring");
  revalidatePath("/transfers");
  return { success: true };
}

const updateCreditSchema = z
  .object({
    id: z.string().uuid(),
    creditLimit: z.string().min(1, "Credit limit is required"),
    creditOpening: z.string().optional(),
    creditLimitCurrency: z.enum(SUPPORTED_CURRENCIES),
    creditStatementDay: z.string().optional(),
    creditPaymentDueDay: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const st = parseOptionalDayOfMonth(
      data.creditStatementDay,
      "Statement date",
    );
    if (!st.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: st.message,
        path: ["creditStatementDay"],
      });
    }
    const pd = parseOptionalDayOfMonth(
      data.creditPaymentDueDay,
      "Payment due date",
    );
    if (!pd.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: pd.message,
        path: ["creditPaymentDueDay"],
      });
    }
  });

export async function updateBankCreditSettings(
  _prev: UpdateCreditActionState,
  formData: FormData,
): Promise<UpdateCreditActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }

  const parsed = updateCreditSchema.safeParse({
    id: formData.get("id"),
    creditLimit: formData.get("creditLimit"),
    creditOpening: formData.get("creditOpening"),
    creditLimitCurrency: formData.get("creditLimitCurrency"),
    creditStatementDay: formData.get("creditStatementDay") ?? undefined,
    creditPaymentDueDay: formData.get("creditPaymentDueDay") ?? undefined,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const db = getDb();
  const acc = await db.query.financialAccounts.findFirst({
    where: and(
      eq(financialAccounts.id, parsed.data.id),
      eq(financialAccounts.userId, userId),
    ),
  });

  if (!acc || acc.type !== "bank" || acc.bankKind !== "credit") {
    return { error: "That account is not a credit bank account" };
  }

  const lim = parseAmountToMinor(parsed.data.creditLimit.trim());
  if (lim === null || lim <= 0) {
    return { error: "Enter a positive credit limit" };
  }

  let creditOpeningBalanceCents = 0;
  const openRaw = parsed.data.creditOpening?.trim() ?? "";
  if (openRaw.length > 0) {
    const o = parseAmountToMinor(openRaw);
    if (o === null) {
      return { error: "Enter a valid starting balance owed (or leave blank for zero)" };
    }
    creditOpeningBalanceCents = o;
  }

  const st = parseOptionalDayOfMonth(
    parsed.data.creditStatementDay,
    "Statement date",
  );
  const pd = parseOptionalDayOfMonth(
    parsed.data.creditPaymentDueDay,
    "Payment due date",
  );
  if (!st.ok) {
    return { error: st.message };
  }
  if (!pd.ok) {
    return { error: pd.message };
  }

  await db
    .update(financialAccounts)
    .set({
      creditLimitCents: lim,
      creditLimitCurrency: parsed.data.creditLimitCurrency,
      creditOpeningBalanceCents,
      creditStatementDayOfMonth: st.value,
      creditPaymentDueDayOfMonth: pd.value,
    })
    .where(
      and(eq(financialAccounts.id, parsed.data.id), eq(financialAccounts.userId, userId)),
    );

  revalidatePath("/accounts");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteFinancialAccount(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return;
  }

  const db = getDb();
  const txInUse = await db.query.transactions.findFirst({
    where: eq(transactions.financialAccountId, id),
  });
  const recurringInUse = await db.query.recurringExpenses.findFirst({
    where: eq(recurringExpenses.financialAccountId, id),
  });
  const transferInUse = await db.query.accountTransfers.findFirst({
    where: and(
      eq(accountTransfers.userId, userId),
      or(
        eq(accountTransfers.fromFinancialAccountId, id),
        eq(accountTransfers.toFinancialAccountId, id),
      ),
    ),
  });
  if (txInUse || recurringInUse || transferInUse) {
    redirect("/accounts?error=in_use");
  }

  await db
    .delete(financialAccounts)
    .where(
      and(eq(financialAccounts.id, id), eq(financialAccounts.userId, userId)),
    );

  revalidatePath("/accounts");
  revalidatePath("/", "layout");
  revalidatePath("/transactions");
  revalidatePath("/recurring");
  revalidatePath("/transfers");
}

export async function getFinancialAccounts() {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const db = getDb();
  const rows = await db.query.financialAccounts.findMany({
    where: eq(financialAccounts.userId, userId),
    orderBy: [
      asc(financialAccounts.type),
      asc(financialAccounts.createdAt),
    ],
  });
  return rows
    .map((r) => ({
      ...r,
      name: decryptFinancePlaintext(userId, r.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type FinancialAccountWithUsage = Awaited<
  ReturnType<typeof getFinancialAccounts>
>[number] & {
  usedCreditCents?: number;
  /** Starting balance + net activity (same currency as `activityCurrency`) for non–credit-card accounts. */
  activityNetCents?: number;
  activityCurrency?: FiatCurrency;
  /** Starting balance stored in a currency other than the navbar (display) currency. */
  openingBalanceForeign?: { cents: number; currency: FiatCurrency };
};

export async function getFinancialAccountsWithUsage(): Promise<
  FinancialAccountWithUsage[]
> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const [accounts, displayCurrency] = await Promise.all([
    getFinancialAccounts(),
    getPreferredCurrency(),
  ]);
  const out: FinancialAccountWithUsage[] = await Promise.all(
    accounts.map(async (a) => {
      const base: FinancialAccountWithUsage = { ...a };
      const isCreditCard = a.type === "bank" && a.bankKind === "credit";
      const isCreditWithLimit =
        isCreditCard &&
        a.creditLimitCents != null &&
        a.creditLimitCurrency != null;

      if (isCreditWithLimit) {
        const usedCreditCents = await computeCreditUsedCents(
          userId,
          a.id,
          a.creditOpeningBalanceCents,
          a.creditLimitCurrency as FiatCurrency,
        );
        base.usedCreditCents = usedCreditCents;
        return base;
      }

      const activityNetCents = await computeAccountNetActivityCents(
        userId,
        a.id,
        displayCurrency,
      );

      let openingContrib = 0;
      if (
        !isCreditCard &&
        a.openingBalanceCents != null &&
        a.openingBalanceCurrency != null &&
        a.openingBalanceCurrency === displayCurrency
      ) {
        openingContrib = a.openingBalanceCents;
      }

      base.activityNetCents = activityNetCents + openingContrib;
      base.activityCurrency = displayCurrency;

      if (
        !isCreditCard &&
        a.openingBalanceCents != null &&
        a.openingBalanceCurrency != null &&
        a.openingBalanceCurrency !== displayCurrency
      ) {
        base.openingBalanceForeign = {
          cents: a.openingBalanceCents,
          currency: a.openingBalanceCurrency as FiatCurrency,
        };
      }

      return base;
    }),
  );
  return out;
}
