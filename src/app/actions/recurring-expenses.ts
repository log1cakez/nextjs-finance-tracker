"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  accountTransfers,
  categories,
  financialAccounts,
  recurringExpenses,
  transactions,
} from "@/db/schema";
import { getSessionUserId } from "@/lib/session";
import { formatTypedLabel } from "@/lib/typed-label-format";
import {
  parseAmountToMinor,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import { getPreferredCurrency } from "@/lib/preferences";
import {
  decryptFinancePlaintext,
  encryptFinanceObject,
  encryptFinancePlaintext,
} from "@/lib/finance-field-crypto";
import { normalizeFinancialAccountRow } from "@/lib/financial-account-crypto";
import { resolveRecurringAmountCents } from "@/lib/recurring-amount-crypto";
import {
  RECURRING_FREQUENCIES,
  isSemimonthlyFrequency,
  isWeekdayRecurringFrequency,
} from "@/lib/recurring-expense-labels";
import { encryptTransactionPayload } from "@/lib/transaction-crypto";

const frequencySchema = z.enum(RECURRING_FREQUENCIES);

function formString(formData: FormData, name: string): string | undefined {
  const v = formData.get(name);
  return typeof v === "string" ? v : undefined;
}

const createSchema = z
  .object({
    kind: z.enum(["income", "expense"]),
    name: z.string().min(1, "Name is required").max(120),
    amount: z.string().optional(),
    amountVariable: z.boolean(),
    currency: z.enum(SUPPORTED_CURRENCIES),
    categoryId: z.string().uuid().optional(),
    financialAccountId: z.string().min(1, "Pick an account").uuid(),
    frequency: z.string().min(1),
    dueDayOfMonth: z.string().optional(),
    secondDueDayOfMonth: z.string().optional(),
    dueWeekday: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const freq = frequencySchema.safeParse(data.frequency.trim());
    if (!freq.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick how often this repeats",
        path: ["frequency"],
      });
      return;
    }

    if (isWeekdayRecurringFrequency(freq.data)) {
      const w = data.dueWeekday?.trim() ?? "";
      const n = Number.parseInt(w, 10);
      if (!Number.isInteger(n) || n < 0 || n > 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pick a day of the week",
          path: ["dueWeekday"],
        });
      }
    } else if (isSemimonthlyFrequency(freq.data)) {
      const d1 = data.dueDayOfMonth?.trim() ?? "";
      const d2 = data.secondDueDayOfMonth?.trim() ?? "";
      const n1 = Number.parseInt(d1, 10);
      const n2 = Number.parseInt(d2, 10);
      if (!Number.isInteger(n1) || n1 < 1 || n1 > 31) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter first day of month (1–31)",
          path: ["dueDayOfMonth"],
        });
        return;
      }
      if (!Number.isInteger(n2) || n2 < 1 || n2 > 31) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter second day of month (1–31)",
          path: ["secondDueDayOfMonth"],
        });
        return;
      }
      if (n1 === n2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pick two different days",
          path: ["secondDueDayOfMonth"],
        });
      }
    } else {
      const d = data.dueDayOfMonth?.trim() ?? "";
      const n = Number.parseInt(d, 10);
      if (!Number.isInteger(n) || n < 1 || n > 31) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a due day of month (1–31)",
          path: ["dueDayOfMonth"],
        });
      }
    }

    if (!data.amountVariable) {
      const minor = parseAmountToMinor(data.amount ?? "");
      if (minor === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid positive amount",
          path: ["amount"],
        });
      }
    }
  });

export type RecurringExpenseActionState = {
  error?: string;
  success?: boolean;
};

export async function createRecurringExpense(
  _prev: RecurringExpenseActionState,
  formData: FormData,
): Promise<RecurringExpenseActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }

  const preferred = await getPreferredCurrency();
  const curRaw = formString(formData, "currency");
  const currencyResolved: FiatCurrency =
    curRaw && SUPPORTED_CURRENCIES.includes(curRaw as FiatCurrency)
      ? (curRaw as FiatCurrency)
      : preferred;

  const kindRaw = formString(formData, "kind");
  const catRaw = formString(formData, "categoryId");
  const amountVariableRaw = formData.get("amountVariable");
  const amountVariable =
    amountVariableRaw === "on" ||
    amountVariableRaw === "true" ||
    amountVariableRaw === "1";
  const parsed = createSchema.safeParse({
    kind:
      kindRaw === "income" || kindRaw === "expense" ? kindRaw : "expense",
    name: formString(formData, "name") ?? "",
    amount: formString(formData, "amount"),
    amountVariable,
    currency: currencyResolved,
    categoryId: catRaw && catRaw.length > 0 ? catRaw : undefined,
    financialAccountId: formString(formData, "financialAccountId") ?? "",
    frequency: formString(formData, "frequency") ?? "",
    dueDayOfMonth: formString(formData, "dueDayOfMonth"),
    secondDueDayOfMonth: formString(formData, "secondDueDayOfMonth"),
    dueWeekday: formString(formData, "dueWeekday"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const minor = parsed.data.amountVariable
    ? null
    : parseAmountToMinor(parsed.data.amount ?? "")!;
  const frequency = frequencySchema.parse(parsed.data.frequency.trim());

  let dueDayOfMonth: number | null = null;
  let secondDueDayOfMonth: number | null = null;
  let dueWeekday: number | null = null;
  if (isWeekdayRecurringFrequency(frequency)) {
    dueWeekday = Number.parseInt(parsed.data.dueWeekday!.trim(), 10);
  } else if (isSemimonthlyFrequency(frequency)) {
    dueDayOfMonth = Number.parseInt(parsed.data.dueDayOfMonth!.trim(), 10);
    secondDueDayOfMonth = Number.parseInt(
      parsed.data.secondDueDayOfMonth!.trim(),
      10,
    );
  } else {
    dueDayOfMonth = Number.parseInt(parsed.data.dueDayOfMonth!.trim(), 10);
  }

  const db = getDb();

  const fin = await db.query.financialAccounts.findFirst({
    where: and(
      eq(financialAccounts.id, parsed.data.financialAccountId),
      eq(financialAccounts.userId, userId),
    ),
  });
  if (!fin) {
    return { error: "Pick a valid account" };
  }
  const finNorm = normalizeFinancialAccountRow(userId, fin);

  if (
    finNorm.bankKind === "credit" &&
    finNorm.creditLimitCurrency != null &&
    parsed.data.currency !== finNorm.creditLimitCurrency
  ) {
    return {
      error: `For this credit card, use template currency ${finNorm.creditLimitCurrency} (same as the card’s limit) so recurring logs update utilization on Accounts.`,
    };
  }

  const creditPaydownRaw = formData.get("creditPaydown");
  const creditPaydown =
    creditPaydownRaw === "on" ||
    creditPaydownRaw === "true" ||
    creditPaydownRaw === "1";
  if (creditPaydown) {
    if (parsed.data.kind !== "expense" || finNorm.bankKind !== "credit") {
      return {
        error:
          "“Card bill payment” only applies when the template is an expense on a credit card account.",
      };
    }
  }

  let categoryId: string | null = null;
  if (parsed.data.categoryId) {
    const cat = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, parsed.data.categoryId),
        eq(categories.userId, userId),
      ),
    });
    if (!cat || cat.kind !== parsed.data.kind) {
      return {
        error: `Pick a ${parsed.data.kind} category or leave blank`,
      };
    }
    categoryId = cat.id;
  }

  const templateName = formatTypedLabel(parsed.data.name.trim());
  if (!templateName) {
    return { error: "Name is required" };
  }

  let encName: string;
  try {
    encName = encryptFinancePlaintext(userId, templateName);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
      return {
        error:
          "Set TRANSACTIONS_ENCRYPTION_KEY to save recurring templates with encrypted names.",
      };
    }
    return { error: "Could not encrypt template name. Try again." };
  }

  let amountPayload: string | null = null;
  let amountCentsCol: number | null = null;
  if (!parsed.data.amountVariable) {
    const m = minor;
    if (m === null) {
      return { error: "Enter a valid positive amount" };
    }
    try {
      amountPayload = encryptFinanceObject(userId, { amountCents: m });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
        return {
          error:
            "Set TRANSACTIONS_ENCRYPTION_KEY to encrypt recurring amounts.",
        };
      }
      return { error: "Could not encrypt template amount. Try again." };
    }
  } else {
    amountPayload = null;
    amountCentsCol = null;
  }

  await db.insert(recurringExpenses).values({
    userId,
    kind: parsed.data.kind,
    name: encName,
    amountCents: amountCentsCol,
    amountPayload,
    amountVariable: parsed.data.amountVariable,
    currency: parsed.data.currency,
    categoryId,
    financialAccountId: parsed.data.financialAccountId,
    creditPaydown,
    frequency,
    dueDayOfMonth,
    secondDueDayOfMonth,
    dueWeekday,
  });

  revalidatePath("/recurring");
  revalidatePath("/", "layout");
  revalidatePath("/transactions");
  return { success: true };
}

export async function deleteRecurringExpense(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return;
  }

  await getDb()
    .delete(recurringExpenses)
    .where(
      and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)),
    );

  revalidatePath("/recurring");
  revalidatePath("/", "layout");
}

export async function logRecurringExpense(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    redirect("/recurring?error=" + encodeURIComponent("Invalid request"));
  }

  const dateStr = formString(formData, "occurredAt") ?? "";
  const occurredAt = new Date(
    `${dateStr.length > 0 ? dateStr : new Date().toISOString().slice(0, 10)}T12:00:00`,
  );
  if (Number.isNaN(occurredAt.getTime())) {
    redirect("/recurring?error=" + encodeURIComponent("Invalid date"));
  }

  const db = getDb();
  const row = await db.query.recurringExpenses.findFirst({
    where: and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)),
  });

  if (!row) {
    redirect("/recurring?error=" + encodeURIComponent("Not found"));
  }

  const finAccount = await db.query.financialAccounts.findFirst({
    where: and(
      eq(financialAccounts.id, row.financialAccountId),
      eq(financialAccounts.userId, userId),
    ),
  });
  const finNorm = finAccount
    ? normalizeFinancialAccountRow(userId, finAccount)
    : null;
  const paydown =
    row.kind === "expense" &&
    row.creditPaydown === true &&
    finNorm?.bankKind === "credit";
  if (
    finNorm?.bankKind === "credit" &&
    finNorm.creditLimitCurrency != null &&
    row.currency !== finNorm.creditLimitCurrency
  ) {
    redirect(
      "/recurring?error=" +
        encodeURIComponent(
          `This template is in ${row.currency} but the card’s limit is tracked in ${finNorm.creditLimitCurrency}. Edit the template currency or card settings so they match — then usage on Accounts will update correctly.`,
        ),
    );
  }

  const fixedTemplateAmount = resolveRecurringAmountCents(userId, row);
  const needsAmountAtLog =
    row.amountVariable || fixedTemplateAmount == null;
  const amountStr = formString(formData, "amount") ?? "";
  let amountMinor: number;
  if (needsAmountAtLog) {
    const m = parseAmountToMinor(amountStr);
    if (m === null) {
      redirect(
        "/recurring?error=" +
          encodeURIComponent("Enter a valid positive amount for this item."),
      );
    }
    amountMinor = m;
  } else {
    amountMinor = fixedTemplateAmount;
  }

  const templateName = decryptFinancePlaintext(userId, row.name);

  let payload: string;
  try {
    payload = encryptTransactionPayload(userId, {
      description: templateName,
      amountCents: amountMinor,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
      redirect(
        "/recurring?error=" +
          encodeURIComponent(
            "Set TRANSACTIONS_ENCRYPTION_KEY to log recurring items.",
          ),
      );
    }
    redirect("/recurring?error=" + encodeURIComponent("Could not encrypt."));
  }

  const rawPostingOverride =
    formString(formData, "payFromFinancialAccountId")?.trim() ?? "";
  const postingOverrideId =
    rawPostingOverride.length > 0 ? rawPostingOverride : null;

  if (
    paydown &&
    postingOverrideId &&
    postingOverrideId !== row.financialAccountId
  ) {
    if (!z.string().uuid().safeParse(postingOverrideId).success) {
      redirect(
        "/recurring?error=" + encodeURIComponent("Invalid pay-from account."),
      );
    }
    const fromAcc = await db.query.financialAccounts.findFirst({
      where: and(
        eq(financialAccounts.id, postingOverrideId),
        eq(financialAccounts.userId, userId),
      ),
    });
    if (!fromAcc) {
      redirect(
        "/recurring?error=" +
          encodeURIComponent("Pick a valid account to pay from."),
      );
    }
    if (!finAccount) {
      redirect("/recurring?error=" + encodeURIComponent("Template account missing."));
    }
    const fromName = decryptFinancePlaintext(userId, fromAcc.name);
    const cardName = decryptFinancePlaintext(userId, finAccount.name);
    const transferDescription = `Recurring card payment: ${templateName} · ${fromName} → ${cardName}`;

    let transferPayload: string;
    try {
      transferPayload = encryptTransactionPayload(userId, {
        description: transferDescription,
        amountCents: amountMinor,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
        redirect(
          "/recurring?error=" +
            encodeURIComponent(
              "Set TRANSACTIONS_ENCRYPTION_KEY to log this payment as a transfer.",
            ),
        );
      }
      redirect("/recurring?error=" + encodeURIComponent("Could not encrypt."));
    }

    await db.insert(accountTransfers).values({
      userId,
      fromFinancialAccountId: postingOverrideId,
      toFinancialAccountId: row.financialAccountId,
      amountCents: null,
      currency: row.currency,
      payload: transferPayload,
      occurredAt,
    });

    revalidatePath("/", "layout");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/recurring");
    revalidatePath("/transfers");
    redirect("/recurring?logged=1&type=transfer");
  }

  let financialAccountIdForTxn = row.financialAccountId;
  if (!paydown && postingOverrideId) {
    if (!z.string().uuid().safeParse(postingOverrideId).success) {
      redirect(
        "/recurring?error=" + encodeURIComponent("Invalid account selection."),
      );
    }
    const overrideAcc = await db.query.financialAccounts.findFirst({
      where: and(
        eq(financialAccounts.id, postingOverrideId),
        eq(financialAccounts.userId, userId),
      ),
    });
    if (!overrideAcc) {
      redirect(
        "/recurring?error=" +
          encodeURIComponent("Pick a valid account for this log."),
      );
    }
    const oNorm = normalizeFinancialAccountRow(userId, overrideAcc);
    if (
      oNorm.bankKind === "credit" &&
      oNorm.creditLimitCurrency != null &&
      row.currency !== oNorm.creditLimitCurrency
    ) {
      redirect(
        "/recurring?error=" +
          encodeURIComponent(
            `Selected account’s card limit is in ${oNorm.creditLimitCurrency}; use template currency ${row.currency} or pick another account.`,
          ),
      );
    }
    financialAccountIdForTxn = postingOverrideId;
  }

  const reducesCreditBalance =
    paydown &&
    financialAccountIdForTxn === row.financialAccountId &&
    finNorm?.bankKind === "credit";

  await db.insert(transactions).values({
    userId,
    payload,
    description: null,
    amountCents: null,
    currency: row.currency,
    kind: row.kind,
    categoryId: row.categoryId,
    financialAccountId: financialAccountIdForTxn,
    reducesCreditBalance,
    occurredAt,
  });

  revalidatePath("/", "layout");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/recurring");
  const q =
    row.kind === "income"
      ? "logged=1&type=income"
      : "logged=1&type=expense";
  redirect(`/recurring?${q}`);
}

export async function getRecurringExpenses() {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const db = getDb();
  const rows = await db.query.recurringExpenses.findMany({
    where: eq(recurringExpenses.userId, userId),
    orderBy: [
      asc(recurringExpenses.kind),
      asc(recurringExpenses.frequency),
      asc(recurringExpenses.createdAt),
    ],
    with: { category: true, financialAccount: true },
  });
  return rows.map((r) => ({
    ...r,
    name: decryptFinancePlaintext(userId, r.name),
    amountCents: resolveRecurringAmountCents(userId, r),
    financialAccount: r.financialAccount
      ? {
          ...normalizeFinancialAccountRow(userId, r.financialAccount),
          name: decryptFinancePlaintext(userId, r.financialAccount.name),
        }
      : null,
  }));
}
