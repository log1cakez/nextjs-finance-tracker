"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
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
  amountCents: number | null;
  amountVariable: boolean;
  currency: string;
  frequency: RecurringFrequencyKind;
  dueDayOfMonth: number | null;
  secondDueDayOfMonth: number | null;
  dueWeekday: number | null;
  category: (typeof categories.$inferSelect) | null;
  financialAccount: (typeof financialAccounts.$inferSelect) | null;
  creditPaydown?: boolean;
};

function logsAmountEachTime(row: RecurringRow): boolean {
  return row.amountVariable || row.amountCents == null;
}

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
              {group.map((row) => {
                const accName = row.financialAccount?.name;
                const catName = row.category?.name;
                const fin = row.financialAccount;
                const creditCurrencyMismatch =
                  fin?.bankKind === "credit" &&
                  fin.creditLimitCurrency != null &&
                  row.currency !== fin.creditLimitCurrency;
                const variable = logsAmountEachTime(row);
                const paydownNote = row.creditPaydown
                  ? "Card bill payment — reduces balance owed"
                  : null;
                const variableMetaLine = variable
                  ? [
                      "Amount varies — enter when you log",
                      paydownNote,
                      accName ?? null,
                      catName ?? null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "";

                return (
                  <li
                    key={row.id}
                    className="min-w-0 rounded-lg bg-zinc-50 px-3 py-3 dark:bg-zinc-900/50"
                  >
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-zinc-900 dark:text-zinc-50">
                          {row.name}
                        </p>
                        <p className="mt-1 break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                          {variable ? (
                            <span className="italic text-zinc-600 dark:text-zinc-400">
                              {variableMetaLine}
                            </span>
                          ) : (
                            <>
                              <span className="tabular-nums">
                                {formatMoney(
                                  row.amountCents!,
                                  row.currency as FiatCurrency,
                                )}
                              </span>
                              {row.creditPaydown
                                ? " · Card bill payment (reduces balance)"
                                : ""}
                              {accName ? ` · ${accName}` : ""}
                              {catName ? ` · ${catName}` : ""}
                            </>
                          )}
                        </p>
                        <p className="mt-1 break-words text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {scheduleSummary(row)}
                        </p>
                        {creditCurrencyMismatch ? (
                          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-snug text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                            Template currency ({row.currency}) does not match this
                            card’s limit currency ({fin!.creditLimitCurrency}). Remove
                            this template and add it again with matching currency so
                            logs update utilization on Accounts.
                          </p>
                        ) : null}
                      </div>
                      <div className="flex min-w-0 w-full flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700/80 sm:flex-row sm:flex-wrap sm:items-end">
                        <form
                          action={logRecurringExpense}
                          className="flex min-w-0 w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:w-auto"
                        >
                          <input type="hidden" name="id" value={row.id} />
                          {variable ? (
                            <input
                              name="amount"
                              type="text"
                              inputMode="decimal"
                              required
                              placeholder="Amount"
                              autoComplete="off"
                              className="min-h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:w-[7.5rem] sm:max-w-[10rem] sm:px-2 sm:py-1.5 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                            />
                          ) : null}
                          <input
                            type="date"
                            name="occurredAt"
                            defaultValue={today}
                            className="min-h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:w-auto sm:px-2 sm:py-1.5 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                          />
                          <button
                            type="submit"
                            disabled={creditCurrencyMismatch}
                            className="min-h-10 w-full shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 sm:w-auto sm:px-2.5 sm:py-1.5 sm:text-xs dark:bg-zinc-100 dark:text-zinc-900"
                          >
                            {row.kind === "income"
                              ? "Log income"
                              : "Log expense"}
                          </button>
                        </form>
                        <form
                          action={deleteRecurringExpense}
                          className="flex sm:inline-flex"
                        >
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            className="min-h-10 w-full text-sm font-medium text-zinc-500 hover:text-rose-600 sm:min-h-0 sm:w-auto sm:text-xs dark:text-zinc-400 dark:hover:text-rose-400"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    </div>
                  </li>
                );
              })}
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
  const [variableAmount, setVariableAmount] = useState(false);
  const [templateAccountId, setTemplateAccountId] = useState<string>("");
  const templateAccount = useMemo(
    () => accountsList.find((a) => a.id === templateAccountId),
    [accountsList, templateAccountId],
  );
  const showTemplateCardPaydown =
    recKind === "expense" && templateAccount?.bankKind === "credit";

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    startTransition(() => {
      setFrequency("");
      setRecKind("expense");
      setVariableAmount(false);
      setTemplateAccountId("");
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
          creates a real transaction on the linked account (same as manual
          transactions — credit utilization and debit activity on Accounts update).
          Use{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            variable amount
          </span>{" "}
          for bills that change (e.g. credit card).
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
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span>
                Amount
                {variableAmount ? (
                  <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                    (set when logging)
                  </span>
                ) : null}
              </span>
            </span>
            <input
              name="amount"
              required={!variableAmount}
              disabled={variableAmount}
              inputMode="decimal"
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder={variableAmount ? "—" : "0.00"}
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

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-700 sm:col-span-2 dark:text-zinc-300">
            <input
              type="checkbox"
              name="amountVariable"
              value="on"
              checked={variableAmount}
              onChange={(e) => setVariableAmount(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 dark:border-zinc-600"
            />
            <span>
              <span className="font-medium">Variable amount</span>
              <span className="mt-0.5 block font-normal text-zinc-500 dark:text-zinc-400">
                No fixed amount on the template (e.g. credit card). You enter
                the amount each time you log.
              </span>
            </span>
          </label>

          {showTemplateCardPaydown ? (
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-700 sm:col-span-2 dark:text-zinc-300">
              <input
                type="checkbox"
                name="creditPaydown"
                value="on"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 dark:border-zinc-600"
              />
              <span>
                <span className="font-medium">Card bill payment template</span>
                <span className="mt-0.5 block font-normal text-zinc-500 dark:text-zinc-400">
                  Each log reduces the balance owed on this card (paying the bill),
                  instead of counting as a new charge.
                </span>
              </span>
            </label>
          ) : null}

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
                value={templateAccountId}
                onChange={(e) => setTemplateAccountId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
