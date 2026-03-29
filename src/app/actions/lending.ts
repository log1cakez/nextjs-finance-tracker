"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { lendingPayments, lendings } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";
import {
  formatMoney,
  parseAmountToMinor,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import { getPreferredCurrency } from "@/lib/preferences";

const kindSchema = z.enum(["receivable", "payable"]);
const styleSchema = z.enum(["lump_sum", "installment"]);

function formString(formData: FormData, name: string): string | undefined {
  const v = formData.get(name);
  return typeof v === "string" ? v : undefined;
}

export type LendingActionState = { error?: string; success?: boolean };

export type LendingPaymentRow = typeof lendingPayments.$inferSelect;

export type LendingWithPayments = {
  lending: typeof lendings.$inferSelect;
  payments: LendingPaymentRow[];
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
    orderBy: [desc(lendings.startedAt), asc(lendings.counterpartyName)],
    with: {
      payments: {
        orderBy: [desc(lendingPayments.paidAt), desc(lendingPayments.createdAt)],
      },
    },
  });

  return rows.map((r) => {
    const { payments: p, ...lending } = r;
    const paidCents = p.reduce((s, x) => s + x.amountCents, 0);
    const remainingCents = Math.max(0, lending.principalCents - paidCents);
    return { lending, payments: p, paidCents, remainingCents };
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

  await getDb().insert(lendings).values({
    userId,
    counterpartyName: parsed.data.counterpartyName.trim(),
    kind: parsed.data.kind,
    principalCents: minor,
    currency: parsed.data.currency,
    repaymentStyle: parsed.data.repaymentStyle,
    startedAt,
    notes: parsed.data.notes?.trim() || null,
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
  const loan = await db.query.lendings.findFirst({
    where: and(
      eq(lendings.id, parsed.data.lendingId),
      eq(lendings.userId, userId),
    ),
    with: {
      payments: true,
    },
  });

  if (!loan) {
    return { error: "Loan not found" };
  }

  const paidSoFar = loan.payments.reduce((s, p) => s + p.amountCents, 0);
  const remaining = Math.max(0, loan.principalCents - paidSoFar);
  if (minor > remaining) {
    return {
      error: `Amount exceeds remaining balance (${formatMoney(remaining, loan.currency as FiatCurrency)}).`,
    };
  }

  await db.insert(lendingPayments).values({
    lendingId: parsed.data.lendingId,
    amountCents: minor,
    paidAt,
    note: parsed.data.note?.trim() || null,
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
