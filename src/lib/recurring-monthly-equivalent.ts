import type { RecurringFrequencyKind } from "@/lib/recurring-expense-labels";

/** Approximate average per calendar month (minor units), for projections. */
export function recurringAmountToMonthlyMinor(
  amountCents: number,
  frequency: RecurringFrequencyKind,
): number {
  switch (frequency) {
    case "weekly":
      return Math.round((amountCents * 52) / 12);
    case "biweekly":
      return Math.round((amountCents * 26) / 12);
    case "semimonthly":
      return amountCents * 2;
    case "monthly":
      return amountCents;
    case "quarterly":
      return Math.round(amountCents / 3);
    case "yearly":
      return Math.round(amountCents / 12);
  }
}

/** Total per calendar year from recurring template amount (minor units). */
export function recurringAmountToYearlyMinor(
  amountCents: number,
  frequency: RecurringFrequencyKind,
): number {
  switch (frequency) {
    case "weekly":
      return amountCents * 52;
    case "biweekly":
      return amountCents * 26;
    case "semimonthly":
      return amountCents * 24;
    case "monthly":
      return amountCents * 12;
    case "quarterly":
      return amountCents * 4;
    case "yearly":
      return amountCents;
  }
}
