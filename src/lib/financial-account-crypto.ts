import type { financialAccounts } from "@/db/schema";
import {
  decryptFinanceObject,
  encryptFinanceObject,
} from "@/lib/finance-field-crypto";
import type { FiatCurrency } from "@/lib/money";

export type FinancialAccountSecurePayload = {
  creditLimitCents: number | null;
  creditLimitCurrency: FiatCurrency | null;
  creditOpeningBalanceCents: number;
  creditStatementDayOfMonth: number | null;
  creditPaymentDueDayOfMonth: number | null;
  openingBalanceCents: number | null;
  openingBalanceCurrency: FiatCurrency | null;
};

const DEFAULTS: FinancialAccountSecurePayload = {
  creditLimitCents: null,
  creditLimitCurrency: null,
  creditOpeningBalanceCents: 0,
  creditStatementDayOfMonth: null,
  creditPaymentDueDayOfMonth: null,
  openingBalanceCents: null,
  openingBalanceCurrency: null,
};

type AccountRow = typeof financialAccounts.$inferSelect;

export type FinancialAccountRowNormalized = AccountRow & FinancialAccountSecurePayload;

export function normalizeFinancialAccountRow(
  userId: string,
  row: AccountRow,
): FinancialAccountRowNormalized {
  if (row.financePayload) {
    const d = decryptFinanceObject<FinancialAccountSecurePayload>(
      userId,
      row.financePayload,
    );
    return { ...row, ...DEFAULTS, ...d };
  }
  return {
    ...row,
    creditLimitCents: row.creditLimitCents ?? null,
    creditLimitCurrency: (row.creditLimitCurrency as FiatCurrency | null) ?? null,
    creditOpeningBalanceCents: row.creditOpeningBalanceCents ?? 0,
    creditStatementDayOfMonth: row.creditStatementDayOfMonth ?? null,
    creditPaymentDueDayOfMonth: row.creditPaymentDueDayOfMonth ?? null,
    openingBalanceCents: row.openingBalanceCents ?? null,
    openingBalanceCurrency: (row.openingBalanceCurrency as FiatCurrency | null) ?? null,
  };
}

export function encryptFinancialAccountPayload(
  userId: string,
  data: FinancialAccountSecurePayload,
): string {
  return encryptFinanceObject(userId, data);
}

