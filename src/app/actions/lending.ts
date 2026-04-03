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
export type UpdateLendingActionState = LendingActionState;

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
  totalInstallments: z.string().optional(),
  startedAt: z.string().min(1, "Date is required"),
  notes: z.string().max(2000).optional(),
  alreadyPaidAmount: z.string().optional(),
  alreadyPaidAt: z.string().optional(),
  alreadyPaidInstallments: z.string().optional(),
  alreadyPaidAccountId: z.string().uuid().optional(),
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
    totalInstallments: formString(formData, "totalInstallments"),
    startedAt: formString(formData, "startedAt"),
    notes: formString(formData, "notes"),
    alreadyPaidAmount: formString(formData, "alreadyPaidAmount"),
    alreadyPaidAt: formString(formData, "alreadyPaidAt"),
    alreadyPaidInstallments: formString(formData, "alreadyPaidInstallments"),
    alreadyPaidAccountId: (() => {
      const v = formString(formData, "alreadyPaidAccountId")?.trim() ?? "";
      return v.length > 0 ? v : undefined;
    })(),
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

  const alreadyPaidRaw = parsed.data.alreadyPaidAmount?.trim() ?? "";
  const alreadyPaidMinor =
    alreadyPaidRaw.length > 0 ? parseAmountToMinor(alreadyPaidRaw) : null;
  if (alreadyPaidRaw.length > 0 && (alreadyPaidMinor === null || alreadyPaidMinor < 0)) {
    return { error: "Already paid must be a valid amount (zero or more)" };
  }
  if (alreadyPaidMinor != null && alreadyPaidMinor > minor) {
    return { error: "Already paid cannot exceed the principal amount" };
  }
  const alreadyPaidAtStr = parsed.data.alreadyPaidAt?.trim() ?? "";
  const alreadyPaidAt =
    alreadyPaidMinor != null && alreadyPaidMinor > 0
      ? new Date(
          `${alreadyPaidAtStr.length > 0 ? alreadyPaidAtStr : parsed.data.startedAt}T12:00:00`,
        )
      : null;
  if (alreadyPaidAt && Number.isNaN(alreadyPaidAt.getTime())) {
    return { error: "Invalid already-paid date" };
  }
  const instRaw = parsed.data.alreadyPaidInstallments?.trim() ?? "";
  const installmentsCount =
    instRaw.length > 0 ? Number.parseInt(instRaw, 10) : null;
  if (
    instRaw.length > 0 &&
    (!Number.isInteger(installmentsCount) || installmentsCount! < 1)
  ) {
    return { error: "Installments already paid must be a whole number (1 or more)" };
  }

  const totalInstRaw = parsed.data.totalInstallments?.trim() ?? "";
  const totalInstallments =
    parsed.data.repaymentStyle === "installment" && totalInstRaw.length > 0
      ? Number.parseInt(totalInstRaw, 10)
      : null;
  if (parsed.data.repaymentStyle === "installment") {
    if (totalInstRaw.length === 0) {
      return { error: "Enter total months/installments for installment loans" };
    }
    if (!Number.isInteger(totalInstallments) || totalInstallments! < 1) {
      return { error: "Total months/installments must be a whole number (1 or more)" };
    }
    const paidCount = installmentsCount ?? (alreadyPaidMinor && alreadyPaidMinor > 0 ? 1 : 0);
    if (paidCount > 0 && totalInstallments! < paidCount) {
      return { error: "Total months/installments cannot be less than already paid count" };
    }
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
      totalInstallments,
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

  const db = getDb();
  const inserted = await db
    .insert(lendings)
    .values({
      userId,
      financePayload,
      counterpartyName: null,
      principalCents: null,
      notes: null,
      kind: parsed.data.kind,
      currency: parsed.data.currency,
      repaymentStyle: parsed.data.repaymentStyle,
      startedAt,
    })
    .returning({ id: lendings.id });

  const lendingId = inserted[0]?.id;
  if (!lendingId) {
    return { error: "Could not save loan. Try again." };
  }

  if (alreadyPaidMinor != null && alreadyPaidMinor !== null && alreadyPaidMinor > 0) {
    let alreadyPaidAccountId: string | null = null;
    if (parsed.data.alreadyPaidAccountId) {
      const acc = await db.query.financialAccounts.findFirst({
        where: and(
          eq(financialAccounts.id, parsed.data.alreadyPaidAccountId),
          eq(financialAccounts.userId, userId),
        ),
        columns: { id: true },
      });
      if (!acc) {
        return { error: "Pick a valid account for the already-paid entry" };
      }
      alreadyPaidAccountId = acc.id;
    }

    let payPayload: string;
    try {
      payPayload = encryptFinanceObject(userId, {
        amountCents: alreadyPaidMinor,
        note:
          parsed.data.repaymentStyle === "installment" && installmentsCount != null
            ? `Imported prior payments (${installmentsCount} installment${installmentsCount === 1 ? "" : "s"})`
            : "Imported prior payment(s)",
        installmentsCount:
          parsed.data.repaymentStyle === "installment" ? installmentsCount : null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
        return {
          error:
            "Set TRANSACTIONS_ENCRYPTION_KEY to record already-paid amounts with encryption.",
        };
      }
      return { error: "Could not encrypt already-paid entry. Try again." };
    }

    await db.insert(lendingPayments).values({
      lendingId,
      financialAccountId: alreadyPaidAccountId,
      financePayload: payPayload,
      amountCents: null,
      note: null,
      paidAt: alreadyPaidAt ?? startedAt,
    });
  }

  revalidatePath("/financetracker/lending");
  revalidatePath("/financetracker", "layout");
  revalidatePath("/financetracker/accounts");
  return { success: true };
}

const updateLendingSchema = z.object({
  id: z.string().uuid(),
  counterpartyName: z.string().min(1, "Name is required").max(120),
  kind: kindSchema,
  amount: z.string().min(1, "Amount is required"),
  currency: z.enum(SUPPORTED_CURRENCIES),
  repaymentStyle: styleSchema,
  totalInstallments: z.string().optional(),
  startedAt: z.string().min(1, "Date is required"),
  notes: z.string().max(2000).optional(),
});

export async function updateLending(
  _prev: UpdateLendingActionState,
  formData: FormData,
): Promise<UpdateLendingActionState> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Sign in required" };

  const preferred = await getPreferredCurrency();
  const curRaw = formString(formData, "currency");
  const currency: FiatCurrency =
    curRaw && SUPPORTED_CURRENCIES.includes(curRaw as FiatCurrency)
      ? (curRaw as FiatCurrency)
      : preferred;

  const parsed = updateLendingSchema.safeParse({
    id: formString(formData, "id"),
    counterpartyName: formString(formData, "counterpartyName"),
    kind: formString(formData, "kind"),
    amount: formString(formData, "amount"),
    currency,
    repaymentStyle: formString(formData, "repaymentStyle"),
    totalInstallments: formString(formData, "totalInstallments"),
    startedAt: formString(formData, "startedAt"),
    notes: formString(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const principalMinor = parseAmountToMinor(parsed.data.amount);
  if (principalMinor === null) return { error: "Enter a valid positive amount" };

  const startedAt = new Date(`${parsed.data.startedAt}T12:00:00`);
  if (Number.isNaN(startedAt.getTime())) return { error: "Invalid start date" };

  const counterparty = formatTypedLabel(parsed.data.counterpartyName.trim());
  if (!counterparty) return { error: "Counterparty name is required" };
  const notesFormatted = parsed.data.notes?.trim()
    ? formatTypedBlock(parsed.data.notes.trim())
    : null;

  const db = getDb();
  const row = await db.query.lendings.findFirst({
    where: and(eq(lendings.id, parsed.data.id), eq(lendings.userId, userId)),
    with: { payments: true },
  });
  if (!row) return { error: "Loan not found" };

  const paidSoFar = row.payments.reduce(
    (s, p) => s + normalizeLendingPaymentRow(userId, p).amountCents,
    0,
  );
  const paidCount = row.payments.reduce(
    (s, p) => s + (normalizeLendingPaymentRow(userId, p).installmentsCount ?? 1),
    0,
  );
  if (principalMinor < paidSoFar) {
    return {
      error: `Principal cannot be less than paid so far (${formatMoney(paidSoFar, row.currency as FiatCurrency)}).`,
    };
  }

  const totalInstRaw = parsed.data.totalInstallments?.trim() ?? "";
  const totalInstallments =
    parsed.data.repaymentStyle === "installment" && totalInstRaw.length > 0
      ? Number.parseInt(totalInstRaw, 10)
      : null;
  if (parsed.data.repaymentStyle === "installment") {
    if (totalInstRaw.length === 0) {
      return { error: "Enter total months/installments for installment loans" };
    }
    if (!Number.isInteger(totalInstallments) || totalInstallments! < 1) {
      return { error: "Total months/installments must be a whole number (1 or more)" };
    }
    if (paidCount > 0 && totalInstallments! < paidCount) {
      return { error: "Total months/installments cannot be less than payments already recorded" };
    }
  }

  let financePayload: string;
  try {
    financePayload = encryptFinanceObject(userId, {
      counterpartyName: counterparty,
      principalCents: principalMinor,
      notes: notesFormatted,
      totalInstallments,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
      return {
        error:
          "Set TRANSACTIONS_ENCRYPTION_KEY to save lending edits with encryption.",
      };
    }
    return { error: "Could not encrypt loan. Try again." };
  }

  await db
    .update(lendings)
    .set({
      financePayload,
      counterpartyName: null,
      principalCents: null,
      notes: null,
      kind: parsed.data.kind,
      currency: parsed.data.currency,
      repaymentStyle: parsed.data.repaymentStyle,
      startedAt,
    })
    .where(and(eq(lendings.id, parsed.data.id), eq(lendings.userId, userId)));

  revalidatePath("/financetracker/lending");
  revalidatePath("/financetracker", "layout");
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

  revalidatePath("/financetracker/lending");
  revalidatePath("/financetracker", "layout");
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

  revalidatePath("/financetracker/lending");
  revalidatePath("/financetracker/transactions");
  revalidatePath("/financetracker", "layout");
  revalidatePath("/financetracker/accounts");
  return { success: true };
}

const updatePaymentSchema = z.object({
  id: z.string().uuid(),
  amount: z.string().min(1, "Amount is required"),
  paidAt: z.string().min(1, "Date is required"),
});

export type UpdateLendingPaymentActionState = {
  error?: string;
  success?: boolean;
};

export async function updateLendingPayment(
  _prev: UpdateLendingPaymentActionState,
  formData: FormData,
): Promise<UpdateLendingPaymentActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }

  const parsed = updatePaymentSchema.safeParse({
    id: formString(formData, "id"),
    amount: formString(formData, "amount"),
    paidAt: formString(formData, "paidAt"),
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
  const row = await db.query.lendingPayments.findFirst({
    where: eq(lendingPayments.id, parsed.data.id),
    with: {
      lending: {
        with: { payments: true },
      },
    },
  });
  if (!row?.lending || row.lending.userId !== userId) {
    return { error: "Payment not found" };
  }

  const loan = normalizeLendingRow(userId, row.lending);
  const currentPay = normalizeLendingPaymentRow(userId, row);
  const otherPaid = row.lending.payments
    .filter((p) => p.id !== row.id)
    .reduce(
      (s, p) => s + normalizeLendingPaymentRow(userId, p).amountCents,
      0,
    );
  if (otherPaid + minor > loan.principalCents) {
    const room = Math.max(0, loan.principalCents - otherPaid);
    return {
      error: `Amount exceeds what is left on this loan (${formatMoney(room, loan.currency as FiatCurrency)} max for this payment).`,
    };
  }

  const payNote = currentPay.note?.trim()
    ? formatTypedLabel(currentPay.note.trim())
    : null;

  let financePayload: string;
  try {
    financePayload = encryptFinanceObject(userId, {
      amountCents: minor,
      note: payNote,
      installmentsCount:
        currentPay.installmentsCount != null && currentPay.installmentsCount > 0
          ? currentPay.installmentsCount
          : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
      return {
        error:
          "Set TRANSACTIONS_ENCRYPTION_KEY to update payments with encryption.",
      };
    }
    return { error: "Could not encrypt payment. Try again." };
  }

  await db
    .update(lendingPayments)
    .set({
      financePayload,
      amountCents: null,
      note: null,
      paidAt,
    })
    .where(eq(lendingPayments.id, parsed.data.id));

  revalidatePath("/financetracker/lending");
  revalidatePath("/financetracker/transactions");
  revalidatePath("/financetracker", "layout");
  revalidatePath("/financetracker/accounts");
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

  revalidatePath("/financetracker/lending");
  revalidatePath("/financetracker/transactions");
  revalidatePath("/financetracker", "layout");
  revalidatePath("/financetracker/accounts");
}
