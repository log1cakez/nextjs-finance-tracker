"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  addLendingPayment,
  createLending,
  deleteLending,
  deleteLendingPayment,
  type LendingPaymentActionState,
  type LendingWithPayments,
  type LendingActionState,
} from "@/app/actions/lending";
import {
  formatMoney,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import { formatTypedBlock, formatTypedLabel } from "@/lib/typed-label-format";

const createInitial: LendingActionState = {};
const payInitial: LendingPaymentActionState = {};

function LendingPaymentForm({
  lendingId,
  disabled,
  defaultDate,
}: {
  lendingId: string;
  disabled: boolean;
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(
    addLendingPayment,
    payInitial,
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.success) return;
    ref.current?.reset();
    const d = ref.current?.querySelector<HTMLInputElement>(
      'input[name="paidAt"]',
    );
    if (d) d.value = defaultDate;
  }, [state.success, defaultDate]);

  if (disabled) {
    return (
      <p className="text-xs text-emerald-600 dark:text-emerald-400">
        Paid in full.
      </p>
    );
  }

  return (
    <form
      ref={ref}
      action={formAction}
      className="flex flex-col gap-3 border-t border-zinc-200 pt-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-2 dark:border-zinc-800"
    >
      <input type="hidden" name="lendingId" value={lendingId} />
      <label className="flex w-full min-w-0 flex-col text-xs font-medium text-zinc-600 sm:min-w-[6rem] sm:max-w-[10rem] sm:flex-1 dark:text-zinc-400">
        Amount
        <input
          name="amount"
          required
          inputMode="decimal"
          placeholder="0.00"
          className="mt-1 min-h-11 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:px-2 sm:py-1.5 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <label className="flex w-full flex-col text-xs font-medium text-zinc-600 sm:w-auto dark:text-zinc-400">
        Date
        <input
          name="paidAt"
          type="date"
          required
          defaultValue={defaultDate}
          className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:w-auto sm:px-2 sm:py-1.5 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <label className="flex w-full min-w-0 flex-col text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Note (optional)
        <input
          name="note"
          maxLength={500}
          className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:px-2 sm:py-1.5 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v) e.currentTarget.value = formatTypedLabel(v);
          }}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full touch-manipulation rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white active:bg-zinc-800 disabled:opacity-60 sm:min-h-9 sm:w-auto sm:text-xs dark:bg-zinc-100 dark:text-zinc-900 dark:active:bg-white"
      >
        {pending ? "…" : "Record payment"}
      </button>
      {state.error ? (
        <p className="w-full text-xs text-rose-600 dark:text-rose-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function LendingCard({ row }: { row: LendingWithPayments }) {
  const { lending, payments, paidCents, remainingCents } = row;
  const c = lending.currency as FiatCurrency;
  const pct =
    lending.principalCents > 0
      ? Math.min(100, Math.round((paidCents / lending.principalCents) * 100))
      : 0;
  const kindLabel =
    lending.kind === "receivable"
      ? "Receivable — they owe you"
      : "Payable — you owe them";
  const styleLabel =
    lending.repaymentStyle === "installment"
      ? "Installment"
      : "Lump sum";

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold text-zinc-900 dark:text-zinc-50">
            {lending.counterpartyName}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {kindLabel} · {styleLabel}
          </p>
          {lending.notes ? (
            <p className="mt-2 break-words text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {lending.notes}
            </p>
          ) : null}
        </div>
        <form action={deleteLending} className="shrink-0 lg:self-start">
          <input type="hidden" name="id" value={lending.id} />
          <button
            type="submit"
            className="min-h-10 w-full touch-manipulation rounded-lg px-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-rose-600 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-rose-400 dark:active:bg-zinc-800 sm:w-auto sm:text-xs"
          >
            Remove loan
          </button>
        </form>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 sm:gap-2">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Principal</p>
          <p className="break-words font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatMoney(lending.principalCents, c)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Paid so far</p>
          <p className="break-words font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatMoney(paidCents, c)}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Remaining</p>
          <p
            className={`break-words font-semibold tabular-nums ${
              remainingCents <= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-900 dark:text-zinc-50"
            }`}
          >
            {formatMoney(remainingCents, c)}
          </p>
        </div>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 sm:h-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-500 transition-[width] dark:from-amber-500 dark:to-amber-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Started{" "}
        {new Date(lending.startedAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </p>

      {payments.length > 0 ? (
        <ul className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Payments
          </p>
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-lg bg-zinc-50/80 px-2 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:bg-transparent sm:px-0 sm:py-0 dark:bg-zinc-900/40 dark:sm:bg-transparent"
            >
              <div className="min-w-0">
                <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatMoney(p.amountCents, c)}
                </span>
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(p.paidAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {p.note ? (
                  <span className="mt-1 block break-words text-xs text-zinc-500 dark:text-zinc-400">
                    {p.note}
                  </span>
                ) : null}
              </div>
              <form action={deleteLendingPayment} className="shrink-0 self-end sm:self-auto">
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="min-h-10 min-w-[2.75rem] touch-manipulation rounded-lg px-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-200 hover:text-rose-600 active:bg-zinc-300 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-rose-400 sm:min-h-0 sm:text-xs"
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3">
        <LendingPaymentForm
          lendingId={lending.id}
          disabled={remainingCents <= 0}
          defaultDate={new Date().toISOString().slice(0, 10)}
        />
      </div>
    </li>
  );
}

export function LendingManager({
  items,
  defaultCurrency,
}: {
  items: LendingWithPayments[];
  defaultCurrency: FiatCurrency;
}) {
  const [state, formAction, pending] = useActionState(
    createLending,
    createInitial,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"receivable" | "payable">("receivable");

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    startTransition(() => setKind("receivable"));
  }, [state.success]);

  const receivables = items.filter((x) => x.lending.kind === "receivable");
  const payables = items.filter((x) => x.lending.kind === "payable");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8 sm:space-y-10">
      <form
        ref={formRef}
        action={formAction}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 sm:p-6"
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          New loan / IOU
        </h2>
        <div className="space-y-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          <ul className="list-none space-y-1.5">
            <li>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Receivable:
              </span>{" "}
              someone borrowed from you.
            </li>
            <li>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Payable:
              </span>{" "}
              you borrowed from them.
            </li>
          </ul>
          <p>
            Record each repayment as a payment until the balance reaches zero.
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Type
          </legend>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg py-1 text-sm text-zinc-700 sm:min-h-0 dark:text-zinc-300">
              <input
                type="radio"
                name="kind"
                value="receivable"
                checked={kind === "receivable"}
                onChange={() => setKind("receivable")}
                className="h-5 w-5 shrink-0 border-zinc-300 text-amber-600 focus:ring-amber-500 sm:h-4 sm:w-4 dark:border-zinc-600"
              />
              Receivable (owed to you)
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg py-1 text-sm text-zinc-700 sm:min-h-0 dark:text-zinc-300">
              <input
                type="radio"
                name="kind"
                value="payable"
                checked={kind === "payable"}
                onChange={() => setKind("payable")}
                className="h-5 w-5 shrink-0 border-zinc-300 text-amber-600 focus:ring-amber-500 sm:h-4 sm:w-4 dark:border-zinc-600"
              />
              Payable (you owe)
            </label>
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-700 sm:col-span-2 dark:text-zinc-300">
            Counterparty name
            <input
              name="counterpartyName"
              required
              maxLength={120}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-0 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="e.g. Alex, Mom, Chase…"
              onBlur={(e) => {
                e.currentTarget.value = formatTypedLabel(e.currentTarget.value);
              }}
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Principal amount
            <input
              name="amount"
              required
              inputMode="decimal"
              className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-0 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="0.00"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Currency
            <select
              key={defaultCurrency}
              name="currency"
              defaultValue={defaultCurrency}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-9 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              {SUPPORTED_CURRENCIES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Repayment
            <select
              name="repaymentStyle"
              defaultValue="lump_sum"
              className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-9 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="lump_sum">Lump sum (one payment)</option>
              <option value="installment">Installment (multiple payments)</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Loan start date
            <input
              name="startedAt"
              type="date"
              required
              defaultValue={today}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-9 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-700 sm:col-span-2 dark:text-zinc-300">
            Notes (optional)
            <textarea
              name="notes"
              rows={2}
              maxLength={2000}
              className="mt-1.5 min-h-[4.5rem] w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-0 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="Terms, reminders…"
              onBlur={(e) => {
                e.currentTarget.value = formatTypedBlock(e.currentTarget.value);
              }}
            />
          </label>
        </div>

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
          disabled={pending}
          className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 active:bg-zinc-950 disabled:opacity-60 sm:h-10 sm:min-h-0 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:active:bg-zinc-200"
        >
          {pending ? "Saving…" : "Add loan"}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 sm:text-lg dark:text-zinc-50">
          Receivables
        </h2>
        {receivables.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
            No receivables yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {receivables.map((row) => (
              <LendingCard key={row.lending.id} row={row} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-900 sm:text-lg dark:text-zinc-50">
          Payables
        </h2>
        {payables.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
            No payables yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {payables.map((row) => (
              <LendingCard key={row.lending.id} row={row} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
