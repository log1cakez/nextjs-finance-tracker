"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createFinancialAccount,
  deleteFinancialAccount,
  type FinancialAccountActionState,
} from "@/app/actions/financial-accounts";
import type { financialAccounts } from "@/db/schema";
import {
  FINANCE_ACCOUNT_LABELS,
  FINANCE_ACCOUNT_TYPE_ORDER,
} from "@/lib/financial-account-labels";

type FinAccount = typeof financialAccounts.$inferSelect;

const initial: FinancialAccountActionState = {};

export function AccountManager({ items }: { items: FinAccount[] }) {
  const [state, formAction, pending] = useActionState(
    createFinancialAccount,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  const byType = FINANCE_ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    label: FINANCE_ACCOUNT_LABELS[type],
    items: items.filter((a) => a.type === type),
  }));

  return (
    <div className="space-y-8">
      <form
        ref={formRef}
        action={formAction}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50"
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          New account
        </h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Name
            <input
              name="name"
              required
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="Chase Checking, Coinbase, LLC Ops…"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:w-52">
            Type
            <select
              name="type"
              defaultValue="bank"
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              {FINANCE_ACCOUNT_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {FINANCE_ACCOUNT_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
        {state.error ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Account added.
          </p>
        ) : null}
      </form>

      <div className="grid gap-6 sm:grid-cols-2">
        {byType.map(({ type, label, items: group }) => (
          <div
            key={type}
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
              <ul className="mt-3 space-y-2">
                {group.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50"
                  >
                    <span className="truncate text-sm text-zinc-800 dark:text-zinc-200">
                      {a.name}
                    </span>
                    <form action={deleteFinancialAccount}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400"
                      >
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
