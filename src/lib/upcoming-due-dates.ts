import type { RecurringFrequencyKind } from "@/lib/recurring-expense-labels";
import {
  isSemimonthlyFrequency,
  isWeekdayRecurringFrequency,
} from "@/lib/recurring-expense-labels";

function utcStartOfDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function addDaysUtc(d: Date, n: number): Date {
  const base = utcStartOfDay(d).getTime();
  return new Date(base + n * 86_400_000);
}

function lastDayOfMonthUtc(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

function clampDomUtc(y: number, m0: number, dom: number): number {
  return Math.min(dom, lastDayOfMonthUtc(y, m0));
}

function firstWeekdayOnOrAfter(d: Date, weekday: number): Date {
  let cur = utcStartOfDay(d);
  for (let i = 0; i < 7; i++) {
    if (cur.getUTCDay() === weekday) {
      return cur;
    }
    cur = addDaysUtc(cur, 1);
  }
  return cur;
}

export type RecurringDueRow = {
  frequency: RecurringFrequencyKind;
  dueDayOfMonth: number | null;
  secondDueDayOfMonth: number | null;
  dueWeekday: number | null;
  createdAt: Date;
};

function matchesRecurringOnDay(row: RecurringDueRow, d: Date): boolean {
  const y = d.getUTCFullYear();
  const m0 = d.getUTCMonth();
  const dom = d.getUTCDate();

  switch (row.frequency) {
    case "weekly": {
      if (row.dueWeekday == null) return false;
      return d.getUTCDay() === row.dueWeekday;
    }
    case "biweekly": {
      if (row.dueWeekday == null) return false;
      if (d.getUTCDay() !== row.dueWeekday) return false;
      const anchor = firstWeekdayOnOrAfter(row.createdAt, row.dueWeekday);
      const weeks = Math.round(
        (utcStartOfDay(d).getTime() - anchor.getTime()) / (7 * 86_400_000),
      );
      return weeks >= 0 && weeks % 2 === 0;
    }
    case "semimonthly": {
      const d1 = row.dueDayOfMonth;
      const d2 = row.secondDueDayOfMonth;
      if (d1 == null || d2 == null) return false;
      const c1 = clampDomUtc(y, m0, d1);
      const c2 = clampDomUtc(y, m0, d2);
      return dom === c1 || dom === c2;
    }
    case "monthly": {
      if (row.dueDayOfMonth == null) return false;
      return dom === clampDomUtc(y, m0, row.dueDayOfMonth);
    }
    case "quarterly": {
      if (row.dueDayOfMonth == null) return false;
      if (![0, 3, 6, 9].includes(m0)) return false;
      return dom === clampDomUtc(y, m0, row.dueDayOfMonth);
    }
    case "yearly": {
      if (row.dueDayOfMonth == null) return false;
      const mAnn = row.createdAt.getUTCMonth();
      if (m0 !== mAnn) return false;
      return dom === clampDomUtc(y, m0, row.dueDayOfMonth);
    }
    default:
      return false;
  }
}

/**
 * Next calendar day (UTC midnight-based) this recurring template is due, on or after `from`.
 */
export function nextRecurringDueDate(
  row: RecurringDueRow,
  from: Date,
): Date | null {
  if (isWeekdayRecurringFrequency(row.frequency)) {
    if (row.dueWeekday == null) return null;
  } else if (isSemimonthlyFrequency(row.frequency)) {
    if (
      row.dueDayOfMonth == null ||
      row.secondDueDayOfMonth == null
    ) {
      return null;
    }
  } else {
    if (row.dueDayOfMonth == null) return null;
  }

  const start = utcStartOfDay(from);
  for (let i = 0; i <= 370; i++) {
    const cand = addDaysUtc(start, i);
    if (matchesRecurringOnDay(row, cand)) {
      return cand;
    }
  }
  return null;
}

/** Next month-day-of-month on or after `from` (for credit card payment due). */
export function nextMonthlyDayOnOrAfter(
  dayOfMonth: number,
  from: Date,
): Date {
  const dom = Math.max(1, Math.min(31, dayOfMonth));
  const start = utcStartOfDay(from);
  let y = start.getUTCFullYear();
  let m0 = start.getUTCMonth();
  const tryDate = (yy: number, mm: number) => {
    const d = clampDomUtc(yy, mm, dom);
    return new Date(Date.UTC(yy, mm, d));
  };
  let cand = tryDate(y, m0);
  if (cand.getTime() < start.getTime()) {
    m0 += 1;
    if (m0 > 11) {
      m0 = 0;
      y += 1;
    }
    cand = tryDate(y, m0);
  }
  return cand;
}
