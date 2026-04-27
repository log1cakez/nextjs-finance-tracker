import type { lendings, lendingPayments } from "@/db/schema";
import { decryptFinanceObject } from "@/lib/finance-field-crypto";

export type LendingSecurePayload = {
  counterpartyName: string;
  principalCents: number;
  notes: string | null;
  /** For installment loans: total count of payments/months expected. */
  totalInstallments?: number | null;
  /** Optional: receivable linked to a credit-card balance borrowed by someone else. */
  linkedCreditAccountId?: string | null;
};

export type LendingPaymentSecurePayload = {
  amountCents: number;
  note: string | null;
  /** Optional: when importing past installment payments as a single aggregate row. */
  installmentsCount?: number | null;
};

export type LendingRowNormalized = typeof lendings.$inferSelect & {
  counterpartyName: string;
  principalCents: number;
  notes: string | null;
  totalInstallments: number | null;
  linkedCreditAccountId: string | null;
};

export type LendingPaymentRowNormalized = typeof lendingPayments.$inferSelect & {
  amountCents: number;
  note: string | null;
  installmentsCount: number | null;
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
      totalInstallments:
        typeof d.totalInstallments === "number" && d.totalInstallments > 0
          ? Math.floor(d.totalInstallments)
          : null,
      linkedCreditAccountId:
        typeof d.linkedCreditAccountId === "string" &&
        d.linkedCreditAccountId.trim().length > 0
          ? d.linkedCreditAccountId
          : null,
    };
  }
  return {
    ...row,
    counterpartyName: row.counterpartyName ?? "",
    principalCents: row.principalCents ?? 0,
    notes: row.notes ?? null,
    totalInstallments: null,
    linkedCreditAccountId: null,
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
      installmentsCount:
        typeof d.installmentsCount === "number" && d.installmentsCount > 0
          ? Math.floor(d.installmentsCount)
          : null,
    };
  }
  return {
    ...row,
    amountCents: row.amountCents ?? 0,
    note: row.note ?? null,
    installmentsCount: null,
  };
}
