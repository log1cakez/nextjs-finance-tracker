"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  createTransaction,
  type TransactionActionState,
} from "@/app/actions/transactions";
import type { categories, financialAccounts } from "@/db/schema";
import { SUPPORTED_CURRENCIES, type FiatCurrency } from "@/lib/money";
import Link from "next/link";

type Category = typeof categories.$inferSelect;
type FinAccount = typeof financialAccounts.$inferSelect;

const initial: TransactionActionState = {};

export function TransactionForm({
  categoriesList,
  accountsList,
  defaultCurrency = "USD",
}: {
  categoriesList: Category[];
  accountsList: FinAccount[];
  defaultCurrency?: FiatCurrency;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createTransaction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [currency, setCurrency] = useState<FiatCurrency>(defaultCurrency);

  const filteredCategories = useMemo(
    () => categoriesList.filter((c) => c.kind === kind),
    [categoriesList, kind],
  );

  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    router.refresh();
  }, [state.success, router]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Add transaction
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
          <input
            name="description"
            required
            className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:border-zinc-400 focus:ring-2 sm:min-h-10 sm:py-2 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            placeholder="Coffee, paycheck…"
            autoComplete="off"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Amount ({currency})
          <input
            name="amount"
            required
            inputMode="decimal"
            className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-10 sm:py-2 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            placeholder="0.00"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Currency
          <select
            name="currency"
            value={currency}
            onChange={(e) =>
              setCurrency(e.target.value as (typeof SUPPORTED_CURRENCIES)[number])
            }
            className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-10 sm:py-2 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c === "USD" ? "USD — US dollar" : "PHP — Philippine peso"}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Type
          <select
            name="kind"
            required
            value={kind}
            onChange={(e) => setKind(e.target.value as "income" | "expense")}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-10 sm:py-2 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Date
          <input
            name="occurredAt"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-10 sm:py-2 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Category (optional)
        <select
          name="categoryId"
          key={kind}
          className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-10 sm:py-2 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          defaultValue=""
        >
          <option value="">None</option>
          {filteredCategories.map((c) => (
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
            Add an account first on the{" "}
            <Link
              href="/accounts"
              className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-200"
            >
              Accounts
            </Link>{" "}
            page.
          </p>
        ) : (
          <select
            name="financialAccountId"
            required
            className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-10 sm:py-2 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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

      {state.error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Saved.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || accountsList.length === 0}
        className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-base font-medium text-white shadow-sm transition hover:bg-zinc-800 active:bg-zinc-950 disabled:opacity-60 sm:min-h-10 sm:w-auto sm:py-2.5 sm:text-sm dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:active:bg-zinc-200"
      >
        {pending ? "Saving…" : "Save transaction"}
      </button>
    </form>
  );
}
