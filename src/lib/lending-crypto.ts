import type { lendings, lendingPayments } from "@/db/schema";
import { decryptFinanceObject } from "@/lib/finance-field-crypto";

export type LendingSecurePayload = {
  counterpartyName: string;
  principalCents: number;
  notes: string | null;
};

export type LendingPaymentSecurePayload = {
  amountCents: number;
  note: string | null;
};

export type LendingRowNormalized = typeof lendings.$inferSelect & {
  counterpartyName: string;
  principalCents: number;
  notes: string | null;
};

export type LendingPaymentRowNormalized = typeof lendingPayments.$inferSelect & {
  amountCents: number;
  note: string | null;
};

export function normalizeLendingRow(
  userId: string,
  row: typeof lendings.$inferSelect,
): LendingRowNormalized {
  if (row.financePayload) {
    const d = decryptFinanceObject<LendingSecurePayload>(
      userId,
      row.financePayload,
    );
    return {
      ...row,
      counterpartyName: d.counterpartyName,
      principalCents: d.principalCents,
      notes: d.notes,
    };
  }
  return {
    ...row,
    counterpartyName: row.counterpartyName ?? "",
    principalCents: row.principalCents ?? 0,
    notes: row.notes ?? null,
  };
}

export function normalizeLendingPaymentRow(
  userId: string,
  row: typeof lendingPayments.$inferSelect,
): LendingPaymentRowNormalized {
  if (row.financePayload) {
    const d = decryptFinanceObject<LendingPaymentSecurePayload>(
      userId,
      row.financePayload,
    );
    return {
      ...row,
      amountCents: d.amountCents,
      note: d.note,
    };
  }
  return {
    ...row,
    amountCents: row.amountCents ?? 0,
    note: row.note ?? null,
  };
}
