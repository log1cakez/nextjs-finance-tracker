import type { recurringExpenses } from "@/db/schema";
import { decryptFinanceObject } from "@/lib/finance-field-crypto";

export type RecurringAmountPayload = { amountCents: number };

type RecRow = typeof recurringExpenses.$inferSelect;

/**
 * Fixed-template amount: from `amount_payload` (encrypted) or legacy `amount_cents`.
 * Returns null for variable templates or missing amount.
 */
export function resolveRecurringAmountCents(
  userId: string,
  row: RecRow,
): number | null {
  if (row.amountVariable) {
    return null;
  }
  if (row.amountPayload) {
    const d = decryptFinanceObject<RecurringAmountPayload>(
      userId,
      row.amountPayload,
    );
    return d.amountCents;
  }
  return row.amountCents ?? null;
}
