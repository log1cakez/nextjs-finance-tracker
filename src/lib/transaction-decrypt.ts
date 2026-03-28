import type { transactions } from "@/db/schema";
import { decryptTransactionPayload } from "@/lib/transaction-crypto";

export type TransactionRow = typeof transactions.$inferSelect;

export type DecryptedTransaction = Omit<
  TransactionRow,
  "description" | "amountCents" | "payload"
> & {
  description: string;
  amountCents: number;
};

export function toDecryptedTransaction(
  userId: string,
  row: TransactionRow,
): DecryptedTransaction {
  const {
    payload,
    description: plainD,
    amountCents: plainA,
    ...meta
  } = row;

  if (payload) {
    try {
      const { description, amountCents } = decryptTransactionPayload(
        userId,
        payload,
      );
      return { ...meta, description, amountCents };
    } catch {
      return {
        ...meta,
        description:
          "Could not decrypt (wrong TRANSACTIONS_ENCRYPTION_KEY or corrupt data)",
        amountCents: 0,
      };
    }
  }

  if (plainD != null && plainA != null) {
    return { ...meta, description: plainD, amountCents: plainA };
  }

  return { ...meta, description: "[Incomplete transaction row]", amountCents: 0 };
}
