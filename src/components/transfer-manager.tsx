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
  createAccountTransfer,
  deleteAccountTransfer,
  type AccountTransferActionState,
  type TransferListItem,
} from "@/app/actions/account-transfers";
import type { financialAccounts } from "@/db/schema";
import {
  useCenterToast,
  useToastOnActionError,
} from "@/components/center-toast";
import { formatTypedLabel } from "@/lib/typed-label-format";
import {
  formatMoney,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";

type FinAccount = typeof financialAccounts.$inferSelect;

const initial: AccountTransferActionState = {};

export function TransferManager({
  accountsList,
  transfers,
  defaultCurrency,
}: {
  accountsList: FinAccount[];
  transfers: TransferListItem[];
  defaultCurrency: FiatCurrency;
}) {
  const [state, formAction, pending] = useActionState(
    createAccountTransfer,
    initial,
  );
  const { showToast } = useCenterToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [fromId, setFromId] = useState<string>("");

  useToastOnActionError(state.error, pending, "Could not save transfer");

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    startTransition(() => setFromId(""));
    showToast({ kind: "success", title: "Transfer saved", timeoutMs: 2200 });
  }, [state.success, showToast]);

  const toOptions = accountsList.filter((a) => a.id !== fromId);

  return (
    <div className="space-y-10">
      <form
        ref={formRef}
        action={formAction}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50"
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          New transfer
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Moves money between your accounts. This does not count as income or
          expense on the dashboard — only as a transfer record.
        </p>

        {accountsList.length < 2 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add at least two accounts on the{" "}
            <Link
              href="/accounts"
              className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-200"
            >
              Accounts
            </Link>{" "}
            page to transfer between them.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              From account
              <select
                name="fromFinancialAccountId"
                required
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              >
                <option value="">Select…</option>
                {accountsList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              To account
              <select
                name="toFinancialAccountId"
                required
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                defaultValue=""
              >
                <option value="" disabled>
                  Select…
                </option>
                {toOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
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
              Date
              <input
                name="occurredAt"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </label>

            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:col-span-2">
              Note (optional)
              <input
                name="note"
                maxLength={500}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                placeholder="e.g. allowance, rebalance…"
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim();
                  if (v) e.currentTarget.value = formatTypedLabel(v);
                }}
              />
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={pending || accountsList.length < 2}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending ? "Saving…" : "Save transfer"}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Transfer history
        </h2>
        {transfers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
            No transfers yet.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/50">
            {transfers.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {t.fromAccount.name} → {t.toAccount.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {t.description}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(t.occurredAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                    {formatMoney(
                      t.amountCents,
                      t.currency as FiatCurrency,
                    )}
                  </span>
                  <form action={deleteAccountTransfer}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
