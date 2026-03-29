"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { accountTransfers, financialAccounts } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";
import {
  parseAmountToMinor,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import { decryptFinancePlaintext } from "@/lib/finance-field-crypto";
import { getPreferredCurrency } from "@/lib/preferences";
import { transferAmountCentsFromRow } from "@/lib/transfer-amount";
import {
  decryptTransactionPayload,
  encryptTransactionPayload,
} from "@/lib/transaction-crypto";

function formString(formData: FormData, name: string): string | undefined {
  const v = formData.get(name);
  return typeof v === "string" ? v : undefined;
}

const createSchema = z.object({
  fromFinancialAccountId: z.string().uuid(),
  toFinancialAccountId: z.string().uuid(),
  amount: z.string().min(1, "Amount is required"),
  currency: z.enum(SUPPORTED_CURRENCIES),
  occurredAt: z.string().min(1, "Date is required"),
  note: z.string().max(500).optional(),
});

export type AccountTransferActionState = {
  error?: string;
  success?: boolean;
};

export async function createAccountTransfer(
  _prev: AccountTransferActionState,
  formData: FormData,
): Promise<AccountTransferActionState> {
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

  const parsed = createSchema.safeParse({
    fromFinancialAccountId: formString(formData, "fromFinancialAccountId"),
    toFinancialAccountId: formString(formData, "toFinancialAccountId"),
    amount: formString(formData, "amount") ?? "",
    currency: currencyResolved,
    occurredAt: formString(formData, "occurredAt") ?? "",
    note: formString(formData, "note"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  if (parsed.data.fromFinancialAccountId === parsed.data.toFinancialAccountId) {
    return { error: "From and to accounts must be different" };
  }

  const minor = parseAmountToMinor(parsed.data.amount);
  if (minor === null) {
    return { error: "Enter a valid positive amount" };
  }

  const occurredAt = new Date(`${parsed.data.occurredAt}T12:00:00`);
  if (Number.isNaN(occurredAt.getTime())) {
    return { error: "Invalid date" };
  }

  const db = getDb();

  const from = await db.query.financialAccounts.findFirst({
    where: and(
      eq(financialAccounts.id, parsed.data.fromFinancialAccountId),
      eq(financialAccounts.userId, userId),
    ),
  });
  const to = await db.query.financialAccounts.findFirst({
    where: and(
      eq(financialAccounts.id, parsed.data.toFinancialAccountId),
      eq(financialAccounts.userId, userId),
    ),
  });

  if (!from || !to) {
    return { error: "Pick valid accounts" };
  }

  const baseLabel = `Transfer: ${decryptFinancePlaintext(userId, from.name)} → ${decryptFinancePlaintext(userId, to.name)}`;
  const note = parsed.data.note?.trim();
  const description = note ? `${baseLabel} — ${note}` : baseLabel;

  let payload: string;
  try {
    payload = encryptTransactionPayload(userId, {
      description,
      amountCents: minor,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("TRANSACTIONS_ENCRYPTION_KEY")) {
      return {
        error:
          "Set TRANSACTIONS_ENCRYPTION_KEY (e.g. openssl rand -hex 32) to record transfers.",
      };
    }
    return { error: "Could not encrypt. Try again." };
  }

  await db.insert(accountTransfers).values({
    userId,
    fromFinancialAccountId: parsed.data.fromFinancialAccountId,
    toFinancialAccountId: parsed.data.toFinancialAccountId,
    amountCents: null,
    currency: parsed.data.currency,
    payload,
    occurredAt,
  });

  revalidatePath("/transfers");
  revalidatePath("/accounts");
  return { success: true };
}

export async function deleteAccountTransfer(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return;
  }

  await getDb()
    .delete(accountTransfers)
    .where(
      and(eq(accountTransfers.id, id), eq(accountTransfers.userId, userId)),
    );

  revalidatePath("/transfers");
  revalidatePath("/accounts");
}

export type TransferListItem = {
  id: string;
  amountCents: number;
  currency: string;
  occurredAt: Date;
  description: string;
  fromAccount: typeof financialAccounts.$inferSelect;
  toAccount: typeof financialAccounts.$inferSelect;
};

export async function getAccountTransfers(): Promise<TransferListItem[]> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const db = getDb();
  const rows = await db.query.accountTransfers.findMany({
    where: eq(accountTransfers.userId, userId),
    orderBy: [desc(accountTransfers.occurredAt)],
    with: {
      fromAccount: true,
      toAccount: true,
    },
  });

  const out: TransferListItem[] = [];
  for (const row of rows) {
    const { fromAccount, toAccount, payload, ...rest } = row;
    if (!fromAccount || !toAccount) {
      continue;
    }
    let description = "[Could not read transfer]";
    try {
      const dec = decryptTransactionPayload(userId, payload);
      description = dec.description;
    } catch {
      // keep placeholder
    }
    out.push({
      id: rest.id,
      amountCents: transferAmountCentsFromRow(userId, {
        amountCents: rest.amountCents,
        payload,
      }),
      currency: rest.currency,
      occurredAt: rest.occurredAt,
      description,
      fromAccount: {
        ...fromAccount,
        name: decryptFinancePlaintext(userId, fromAccount.name),
      },
      toAccount: {
        ...toAccount,
        name: decryptFinancePlaintext(userId, toAccount.name),
      },
    });
  }
  return out;
}
