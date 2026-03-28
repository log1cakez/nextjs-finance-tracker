"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  createRecurringExpense,
  deleteRecurringExpense,
  logRecurringExpense,
  type RecurringExpenseActionState,
} from "@/app/actions/recurring-expenses";
import type { categories, financialAccounts } from "@/db/schema";
import {
  formatMoney,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import {
  RECURRING_FREQUENCY_LABELS,
  RECURRING_FREQUENCIES,
  isSemimonthlyFrequency,
  isWeekdayRecurringFrequency,
  dueDayOfMonthFieldCaption,
  requiresDueDayOfMonthField,
  weekdayLabel,
  type RecurringFrequencyKind,
} from "@/lib/recurring-expense-labels";

type Category = typeof categories.$inferSelect;
type FinAccount = typeof financialAccounts.$inferSelect;

type RecurringKind = "income" | "expense";

type RecurringRow = {
  id: string;
  kind: RecurringKind;
  name: string;
  amountCents: number;
  currency: string;
  frequency: RecurringFrequencyKind;
  dueDayOfMonth: number | null;
  secondDueDayOfMonth: number | null;
  dueWeekday: number | null;
  category: (typeof categories.$inferSelect) | null;
  financialAccount: (typeof financialAccounts.$inferSelect) | null;
};

const initial: RecurringExpenseActionState = {};

function scheduleSummary(row: RecurringRow): string {
  const f = RECURRING_FREQUENCY_LABELS[row.frequency];
  if (isSemimonthlyFrequency(row.frequency)) {
    if (
      row.dueDayOfMonth != null &&
      row.secondDueDayOfMonth != null
    ) {
      return `${f} · days ${row.dueDayOfMonth} & ${row.secondDueDayOfMonth}`;
    }
    return f;
  }
  if (isWeekdayRecurringFrequency(row.frequency)) {
    const w = weekdayLabel(row.dueWeekday);
    return w ? `${f} · ${w}` : f;
  }
  if (row.dueDayOfMonth != null) {
    return `${f} · day ${row.dueDayOfMonth}`;
  }
  return f;
}

function FrequencyGroups({
  items,
  today,
}: {
  items: RecurringRow[];
  today: string;
}) {
  const byFrequency = RECURRING_FREQUENCIES.map((freq) => ({
    freq,
    label: RECURRING_FREQUENCY_LABELS[freq],
    group: items.filter((r) => r.frequency === freq),
  }));

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {byFrequency.map(({ freq, label, group }) => (
        <div
          key={freq}
          className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/50"
        >
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {label}
          </h3>
          {group.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              None yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {group.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-900/50"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {row.name}
                      </p>
                      <p className="mt-0.5 text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                        {formatMoney(
                          row.amountCents,
                          row.currency as FiatCurrency,
                        )}
                        {row.financialAccount
                          ? ` · ${row.financialAccount.name}`
                          : ""}
                        {row.category ? ` · ${row.category.name}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {scheduleSummary(row)}
                      </p>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0">
                      <form
                        action={logRecurringExpense}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="id" value={row.id} />
                        <input
                          type="date"
                          name="occurredAt"
                          defaultValue={today}
                          className="min-h-9 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                        >
                          {row.kind === "income"
                            ? "Log income"
                            : "Log expense"}
                        </button>
                      </form>
                      <form action={deleteRecurringExpense} className="inline-flex">
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export function RecurringExpenseManager({
  items,
  accountsList,
  expenseCategories,
  incomeCategories,
  defaultCurrency,
}: {
  items: RecurringRow[];
  accountsList: FinAccount[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  defaultCurrency: FiatCurrency;
}) {
  const [state, formAction, pending] = useActionState(
    createRecurringExpense,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [frequency, setFrequency] = useState<string>("");
  const [recKind, setRecKind] = useState<RecurringKind>("expense");

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    startTransition(() => {
      setFrequency("");
      setRecKind("expense");
    });
  }, [state.success]);

  const categoryList =
    recKind === "expense" ? expenseCategories : incomeCategories;

  const showWeekday =
    frequency !== "" &&
    isWeekdayRecurringFrequency(frequency as RecurringFrequencyKind);
  const showDayOfMonth =
    frequency !== "" &&
    requiresDueDayOfMonthField(frequency as RecurringFrequencyKind);
  const showSemimonthlyDays =
    frequency !== "" &&
    isSemimonthlyFrequency(frequency as RecurringFrequencyKind);

  const today = new Date().toISOString().slice(0, 10);

  const expenseItems = items.filter((r) => r.kind === "expense");
  const incomeItems = items.filter((r) => r.kind === "income");

  return (
    <div className="space-y-10">
      <form
        ref={formRef}
        action={formAction}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50"
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          New recurring template
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Set up scheduled income or expenses with category and account.{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Log
          </span>{" "}
          creates a real transaction on the date you choose.
        </p>

        <input type="hidden" name="kind" value={recKind} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Type
          <select
            value={recKind}
            onChange={(e) =>
              setRecKind(e.target.value as RecurringKind)
            }
            className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">
            Name
            <input
              name="name"
              required
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder={
                recKind === "expense"
                  ? "Rent, gym, streaming…"
                  : "Paycheck, dividends…"
              }
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Amount
            <input
              name="amount"
              required
              inputMode="decimal"
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="0.00"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Currency
            <select
              key={defaultCurrency}
              name="currency"
              defaultValue={defaultCurrency}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Category (optional)
            <select
              name="categoryId"
              key={recKind}
              defaultValue=""
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="">None</option>
              {categoryList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Account
            {accountsList.length === 0 ? (
              <p className="mt-1.5 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                Add an account on the{" "}
                <Link
                  href="/accounts"
                  className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-200"
                >
                  Accounts
                </Link>{" "}
                page first.
              </p>
            ) : (
              <select
                name="financialAccountId"
                required
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                defaultValue=""
              >
                <option value="" disabled>
                  Select account…
                </option>
                {accountsList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">
            How often
            <select
              name="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="">Select…</option>
              {RECURRING_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {RECURRING_FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </label>

          {showWeekday ? (
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">
              Due on (weekday)
              <select
                name="dueWeekday"
                required
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                defaultValue=""
              >
                <option value="" disabled>
                  Select…
                </option>
                {(
                  [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ] as const
                ).map((label, i) => (
                  <option key={label} value={String(i)}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {showSemimonthlyDays ? (
            <>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                First day each month (1–31)
                <input
                  name="dueDayOfMonth"
                  type="number"
                  min={1}
                  max={31}
                  required
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  placeholder="e.g. 1"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Second day each month (1–31)
                <input
                  name="secondDueDayOfMonth"
                  type="number"
                  min={1}
                  max={31}
                  required
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  placeholder="e.g. 15"
                />
              </label>
            </>
          ) : null}

          {showDayOfMonth ? (
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">
              {dueDayOfMonthFieldCaption(
                frequency as RecurringFrequencyKind,
              )}
              <input
                name="dueDayOfMonth"
                type="number"
                min={1}
                max={31}
                required
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                placeholder={
                  frequency === "quarterly" ? "e.g. 15" : "e.g. 1"
                }
              />
            </label>
          ) : null}
        </div>

        {state.error ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Template saved.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || accountsList.length === 0}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending ? "Saving…" : "Add template"}
        </button>
      </form>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Recurring expenses
        </h2>
        <FrequencyGroups items={expenseItems} today={today} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Recurring income
        </h2>
        <FrequencyGroups items={incomeItems} today={today} />
      </section>
    </div>
  );
}
