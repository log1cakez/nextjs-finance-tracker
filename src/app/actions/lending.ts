"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { financialAccounts, lendingPayments, lendings } from "@/db/schema";
import { encryptFinanceObject } from "@/lib/finance-field-crypto";
import {
  normalizeLendingPaymentRow,
  normalizeLendingRow,
  type LendingPaymentRowNormalized,
  type LendingRowNormalized,
} from "@/lib/lending-crypto";
import { getSessionUserId } from "@/lib/session";
import {
  formatMoney,
  parseAmountToMinor,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import { getPreferredCurrency } from "@/lib/preferences";
import { formatTypedBlock, formatTypedLabel } from "@/lib/typed-label-format";

const kindSchema = z.enum(["receivable", "payable"]);
const styleSchema = z.enum(["lump_sum", "installment"]);

function formString(formData: FormData, name: string): string | undefined {
  const v = formData.get(name);
  return typeof v === "string" ? v : undefined;
}

export type LendingActionState = { error?: string; success?: boolean };

export type LendingPaymentRow = LendingPaymentRowNormalized;

export type LendingWithPayments = {
  lending: LendingRowNormalized;
  payments: LendingPaymentRowNormalized[];
  paidCents: number;
  remainingCents: number;
};

export async function getLendingsWithPayments(): Promise<LendingWithPayments[]> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const db = getDb();
  const rows = await db.query.lendings.findMany({
    where: eq(lendings.userId, userId),
    orderBy: [desc(lendings.startedAt), asc(lendings.id)],
    with: {
      payments: {
        orderBy: [desc(lendingPayments.paidAt), desc(lendingPayments.createdAt)],
      },
    },
  });

  return rows.map((r) => {
    const { payments: p, ...lendingRaw } = r;
    const lending = normalizeLendingRow(userId, lendingRaw);
    const payments = p.map((x) => normalizeLendingPaymentRow(userId, x));
    const paidCents = payments.reduce((s, x) => s + x.amountCents, 0);
    const remainingCents = Math.max(0, lending.principalCents - paidCents);
    return { lending, payments, paidCents, remainingCents };
  });
}

const createLendingSchema = z.object({
  counterpartyName: z.string().min(1, "Name is required").max(120),
  kind: kindSchema,
  amount: z.string().min(1, "Amount is required"),
  currency: z.enum(SUPPORTED_CURRENCIES),
  repaymentStyle: styleSchema,
  startedAt: z.string().min(1, "Date is required"),
  notes: z.string().max(2000).optional(),
});

export async function createLending(
  _prev: LendingActionState,
  formData: FormData,
): Promise<LendingActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }

  const preferred = await getPreferredCurrency();
  const curRaw = formString(formData, "currency");
  const currency: FiatCurrency =
    curRaw && SUPPORTED_CURRENCIES.includes(curRaw as FiatCurrency)
      ? (curRaw as FiatCurrency)
      : preferred;

  const parsed = createLendingSchema.safeParse({
    counterpartyName: formString(formData, "counterpartyName"),
    kind: formString(formData, "kind"),
    amount: formString(formData, "amount"),
    currency,
    repaymentStyle: formString(formData, "repaymentStyle"),
    startedAt: formString(formData, "startedAt"),
    notes: formString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const minor = parseAmountToMinor(parsed.data.amount);
  if (minor === null) {
    return { error: "Enter a valid positive amount" };
  }

  const startedAt = new Date(`${parsed.data.startedAt}T12:00:00`);
  if (Number.isNaN(startedAt.getTime())) {
    return { error: "Invalid start date" };
  }

  const counterparty = formatTypedLabel(parsed.data.counterpartyName.trim());
  if (!counterparty) {
    return { error: "Counterparty name is required" };
  }
  const notesFormatted = parsed.data.notes?.trim()
    ? formatTypedBlock(parsed.data.notes.trim())
    : null;

  let financePayload: string;
  try {
    financePayload = encryptFinanceObject(userId, {
      counterpartyName: counterparty,
      principalCents: minor,
      notes: notesFormatted,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
      return {
        error:
          "Set TRANSACTIONS_ENCRYPTION_KEY (e.g. openssl rand -hex 32) to save lending data encrypted.",
      };
    }
    return { error: "Could not encrypt loan. Try again." };
  }

  await getDb().insert(lendings).values({
    userId,
    financePayload,
    counterpartyName: null,
    principalCents: null,
    notes: null,
    kind: parsed.data.kind,
    currency: parsed.data.currency,
    repaymentStyle: parsed.data.repaymentStyle,
    startedAt,
  });

  revalidatePath("/lending");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteLending(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return;
  }

  await getDb()
    .delete(lendings)
    .where(and(eq(lendings.id, id), eq(lendings.userId, userId)));

  revalidatePath("/lending");
  revalidatePath("/", "layout");
}

const addPaymentSchema = z.object({
  lendingId: z.string().uuid(),
  amount: z.string().min(1, "Amount is required"),
  paidAt: z.string().min(1, "Date is required"),
  financialAccountId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

export type LendingPaymentActionState = { error?: string; success?: boolean };

export async function addLendingPayment(
  _prev: LendingPaymentActionState,
  formData: FormData,
): Promise<LendingPaymentActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }

  const parsed = addPaymentSchema.safeParse({
    lendingId: formString(formData, "lendingId"),
    amount: formString(formData, "amount"),
    paidAt: formString(formData, "paidAt"),
    financialAccountId: (() => {
      const v = formString(formData, "financialAccountId")?.trim() ?? "";
      return v.length > 0 ? v : undefined;
    })(),
    note: formString(formData, "note"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const minor = parseAmountToMinor(parsed.data.amount);
  if (minor === null || minor <= 0) {
    return { error: "Enter a valid positive amount" };
  }

  const paidAt = new Date(`${parsed.data.paidAt}T12:00:00`);
  if (Number.isNaN(paidAt.getTime())) {
    return { error: "Invalid date" };
  }

  const db = getDb();
  const loanRow = await db.query.lendings.findFirst({
    where: and(
      eq(lendings.id, parsed.data.lendingId),
      eq(lendings.userId, userId),
    ),
    with: {
      payments: true,
    },
  });

  if (!loanRow) {
    return { error: "Loan not found" };
  }

  let financialAccountId: string | null = null;
  if (parsed.data.financialAccountId) {
    const acc = await db.query.financialAccounts.findFirst({
      where: and(
        eq(financialAccounts.id, parsed.data.financialAccountId),
        eq(financialAccounts.userId, userId),
      ),
      columns: { id: true },
    });
    if (!acc) {
      return { error: "Pick a valid account for this payment" };
    }
    financialAccountId = acc.id;
  }

  const { payments, ...lRaw } = loanRow;
  const loan = normalizeLendingRow(userId, lRaw);
  const paidSoFar = payments.reduce(
    (s, p) => s + normalizeLendingPaymentRow(userId, p).amountCents,
    0,
  );
  const remaining = Math.max(0, loan.principalCents - paidSoFar);
  if (minor > remaining) {
    return {
      error: `Amount exceeds remaining balance (${formatMoney(remaining, loan.currency as FiatCurrency)}).`,
    };
  }

  const payNote = parsed.data.note?.trim()
    ? formatTypedLabel(parsed.data.note.trim())
    : null;

  let financePayload: string;
  try {
    financePayload = encryptFinanceObject(userId, {
      amountCents: minor,
      note: payNote,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
      return {
        error:
          "Set TRANSACTIONS_ENCRYPTION_KEY to record payments with encryption.",
      };
    }
    return { error: "Could not encrypt payment. Try again." };
  }

  await db.insert(lendingPayments).values({
    lendingId: parsed.data.lendingId,
    financialAccountId,
    financePayload,
    amountCents: null,
    note: null,
    paidAt,
  });

  revalidatePath("/lending");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteLendingPayment(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return;
  }

  const db = getDb();
  const row = await db.query.lendingPayments.findFirst({
    where: eq(lendingPayments.id, id),
    with: { lending: true },
  });
  if (!row?.lending || row.lending.userId !== userId) {
    return;
  }

  await db
    .delete(lendingPayments)
    .where(eq(lendingPayments.id, id));

  revalidatePath("/lending");
  revalidatePath("/", "layout");
}
