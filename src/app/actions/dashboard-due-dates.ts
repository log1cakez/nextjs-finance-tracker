"use server";

import { getFinancialAccounts } from "@/app/actions/financial-accounts";
import { getRecurringExpenses } from "@/app/actions/recurring-expenses";
import { getSessionUserId } from "@/lib/session";
import type { RecurringFrequencyKind } from "@/lib/recurring-expense-labels";
import { resolveRecurringAmountCents } from "@/lib/recurring-amount-crypto";
import { formatMoney, type FiatCurrency } from "@/lib/money";
import {
  nextMonthlyDayOnOrAfter,
  nextRecurringDueDate,
} from "@/lib/upcoming-due-dates";

export type DashboardDueDateEntry = {
  id: string;
  /** YYYY-MM-DD (UTC calendar) for sorting and display */
  dateKey: string;
  title: string;
  detail: string;
  kind: "income" | "expense" | "credit_payment";
};

export async function getDashboardUpcomingDueDates(): Promise<
  DashboardDueDateEntry[] | null
> {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }

  const [recurring, accounts] = await Promise.all([
    getRecurringExpenses(),
    getFinancialAccounts(),
  ]);

  const from = new Date();
  const out: DashboardDueDateEntry[] = [];

  for (const r of recurring) {
    const next = nextRecurringDueDate(
      {
        frequency: r.frequency as RecurringFrequencyKind,
        dueDayOfMonth: r.dueDayOfMonth,
        secondDueDayOfMonth: r.secondDueDayOfMonth,
        dueWeekday: r.dueWeekday,
        createdAt: new Date(r.createdAt),
      },
      from,
    );
    if (!next) {
      continue;
    }
    const dateKey = next.toISOString().slice(0, 10);
    const amt = resolveRecurringAmountCents(userId, r);
    const cur = r.currency as FiatCurrency;
    const money =
      amt != null ? formatMoney(amt, cur) : "Variable amount";
    const acc = r.financialAccount?.name ?? "Account";
    const kindLabel = r.kind === "income" ? "Income" : "Expense";
    out.push({
      id: `rec:${r.id}`,
      dateKey,
      title: r.name,
      detail: `${kindLabel} · ${money} · ${acc}`,
      kind: r.kind,
    });
  }

  for (const a of accounts) {
    if (a.type !== "bank" || a.bankKind !== "credit") {
      continue;
    }
    if (a.creditPaymentDueDayOfMonth == null) {
      continue;
    }
    const next = nextMonthlyDayOnOrAfter(a.creditPaymentDueDayOfMonth, from);
    const dateKey = next.toISOString().slice(0, 10);
    out.push({
      id: `cc:${a.id}`,
      dateKey,
      title: `${a.name} — payment due`,
      detail: `Credit card · due around the ${a.creditPaymentDueDayOfMonth}${ordinalSuffix(a.creditPaymentDueDayOfMonth)} of each month`,
      kind: "credit_payment",
    });
  }

  out.sort((x, y) => {
    const c = x.dateKey.localeCompare(y.dateKey);
    return c !== 0 ? c : x.title.localeCompare(y.title);
  });

  return out.slice(0, 40);
}

function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}
