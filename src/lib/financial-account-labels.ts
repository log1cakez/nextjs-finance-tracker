export const FINANCE_ACCOUNT_TYPES = [
  "bank",
  "crypto",
  "forex",
  "business",
  "cash",
  "other",
] as const;

export type FinanceAccountKind = (typeof FINANCE_ACCOUNT_TYPES)[number];

export const FINANCE_ACCOUNT_TYPE_ORDER: FinanceAccountKind[] = [
  "bank",
  "business",
  "crypto",
  "forex",
  "cash",
  "other",
];

export const FINANCE_ACCOUNT_LABELS: Record<FinanceAccountKind, string> = {
  bank: "Bank",
  crypto: "Crypto",
  forex: "Forex / trading",
  business: "Business",
  cash: "Cash",
  other: "Other",
};
