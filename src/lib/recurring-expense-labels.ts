export const RECURRING_FREQUENCIES = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "quarterly",
  "yearly",
] as const;

export type RecurringFrequencyKind = (typeof RECURRING_FREQUENCIES)[number];

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequencyKind, string> =
  {
    weekly: "Weekly",
    biweekly: "Bi-weekly",
    semimonthly: "Twice monthly",
    monthly: "Monthly",
    quarterly: "Quarterly (every 3 months)",
    yearly: "Yearly",
  };

export function isWeekdayRecurringFrequency(
  f: RecurringFrequencyKind,
): boolean {
  return f === "weekly" || f === "biweekly";
}

/** Twice per month; user picks two days (1–31). */
export function isSemimonthlyFrequency(
  f: RecurringFrequencyKind,
): boolean {
  return f === "semimonthly";
}

export function requiresDueDayOfMonthField(
  f: RecurringFrequencyKind,
): boolean {
  return !isWeekdayRecurringFrequency(f) && !isSemimonthlyFrequency(f);
}

/** Label for the single day-of-month field (monthly / quarterly / yearly). */
export function dueDayOfMonthFieldCaption(
  f: RecurringFrequencyKind,
): string {
  switch (f) {
    case "monthly":
      return "Day of each month (1–31)";
    case "quarterly":
      return "Day each quarter (1–31), e.g. 15 → Jan / Apr / Jul / Oct";
    case "yearly":
      return "Day each year (1–31)";
    default:
      return "Due day of month (1–31)";
  }
}

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function weekdayLabel(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  if (n < 0 || n > 6) return null;
  return weekdays[n];
}
