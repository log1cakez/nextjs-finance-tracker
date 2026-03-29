import { decryptTransactionPayload } from "@/lib/transaction-crypto";

/** Amount may be only inside encrypted `payload` for new transfers. */
export function transferAmountCentsFromRow(
  userId: string,
  row: { amountCents: number | null; payload: string },
): number {
  if (row.amountCents != null) {
    return row.amountCents;
  }
  return decryptTransactionPayload(userId, row.payload).amountCents;
}
