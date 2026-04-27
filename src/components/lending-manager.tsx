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
  updateLending,
  updateLendingPayment,
  deleteLending,
  deleteLendingPayment,
  type LendingPaymentActionState,
  type LendingWithPayments,
  type LendingActionState,
  type UpdateLendingActionState,
  type UpdateLendingPaymentActionState,
} from "@/app/actions/lending";
import type { LendingPaymentRowNormalized } from "@/lib/lending-crypto";
import {
  useCenterToast,
  useToastOnActionError,
} from "@/components/center-toast";
import {
  formatMoney,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import { formatTypedBlock, formatTypedLabel } from "@/lib/typed-label-format";

const createInitial: LendingActionState = {};
const payInitial: LendingPaymentActionState = {};
const updateInitial: UpdateLendingActionState = {};
const payEditInitial: UpdateLendingPaymentActionState = {};

function centsToDecimalInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Installment loans only: ceil(remaining ÷ periods left) from total installments
 * minus installments already recorded (via payment rows).
 */
function estimatedPaymentPerMonthInfo(
  lending: LendingWithPayments["lending"],
  remainingCents: number,
  installmentsPaidCount: number,
): { amountCents: number; periodsLeft: number } | null {
  if (remainingCents <= 0) return null;
  if (lending.repaymentStyle !== "installment") return null;
  if (lending.totalInstallments == null || lending.totalInstallments < 1) {
    return null;
  }
  const paid = Math.min(
    Math.max(0, installmentsPaidCount),
    lending.totalInstallments,
  );
  const periodsLeft = Math.max(1, lending.totalInstallments - paid);
  return {
    amountCents: Math.ceil(remainingCents / periodsLeft),
    periodsLeft,
  };
}

function LendingPaymentForm({
  lendingId,
  disabled,
  defaultDate,
  accountsList,
}: {
  lendingId: string;
  disabled: boolean;
  defaultDate: string;
  accountsList: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    addLendingPayment,
    payInitial,
  );
  const { showToast } = useCenterToast();
  const ref = useRef<HTMLFormElement>(null);

  useToastOnActionError(state.error, pending, "Could not record payment");

  useEffect(() => {
    if (!state.success) return;
    ref.current?.reset();
    const d = ref.current?.querySelector<HTMLInputElement>(
      'input[name="paidAt"]',
    );
    if (d) d.value = defaultDate;
    showToast({ kind: "success", title: "Payment recorded", timeoutMs: 2000 });
  }, [state.success, defaultDate, showToast]);

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
      <label className="flex w-full min-w-0 flex-col text-xs font-medium text-zinc-600 sm:min-w-[10rem] sm:flex-1 dark:text-zinc-400">
        Account (optional)
        <select
          name="financialAccountId"
          defaultValue=""
          className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:px-2 sm:py-1.5 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        >
          <option value="">—</option>
          {accountsList.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
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
    </form>
  );
}

function LendingPaymentListItem({
  payment,
  currency,
}: {
  payment: LendingPaymentRowNormalized;
  currency: FiatCurrency;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateLendingPayment,
    payEditInitial,
  );
  const { showToast } = useCenterToast();

  useToastOnActionError(state.error, pending, "Could not update payment");

  useEffect(() => {
    if (!state.success) return;
    setEditing(false);
    showToast({ kind: "success", title: "Payment updated", timeoutMs: 1800 });
  }, [state.success, showToast]);

  const paidAt =
    payment.paidAt instanceof Date
      ? payment.paidAt
      : new Date(payment.paidAt);

  if (editing) {
    return (
      <li
        className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/60"
      >
        <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <input type="hidden" name="id" value={payment.id} />
          <label className="flex w-full min-w-0 flex-col text-xs font-medium text-zinc-600 sm:w-[7.5rem] dark:text-zinc-400">
            Amount
            <input
              name="amount"
              required
              inputMode="decimal"
              defaultValue={centsToDecimalInput(payment.amountCents)}
              className="mt-1 min-h-10 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
          <label className="flex w-full min-w-0 flex-col text-xs font-medium text-zinc-600 sm:w-auto dark:text-zinc-400">
            Date
            <input
              name="paidAt"
              type="date"
              required
              defaultValue={dateInputValue(paidAt)}
              className="mt-1 min-h-10 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button
              type="submit"
              disabled={pending}
              className="min-h-10 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {pending ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-10 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg bg-zinc-50/80 px-2 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:bg-transparent sm:px-0 sm:py-0 dark:bg-zinc-900/40 dark:sm:bg-transparent">
      <div className="min-w-0">
        <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
          {formatMoney(payment.amountCents, currency)}
        </span>
        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
          {paidAt.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
        {payment.note ? (
          <span className="mt-1 block break-words text-xs text-zinc-500 dark:text-zinc-400">
            {payment.note}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-10 rounded-lg px-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          Edit
        </button>
        <form action={deleteLendingPayment} className="inline">
          <input type="hidden" name="id" value={payment.id} />
          <button
            type="submit"
            className="min-h-10 min-w-[2.75rem] touch-manipulation rounded-lg px-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-200 hover:text-rose-600 active:bg-zinc-300 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-rose-400"
          >
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}

function LendingCard({
  row,
  accountsList,
  defaultCurrency,
}: {
  row: LendingWithPayments;
  accountsList: { id: string; name: string; type: string; bankKind: string | null }[];
  defaultCurrency: FiatCurrency;
}) {
  const { lending, payments, paidCents, remainingCents } = row;
  const c = lending.currency as FiatCurrency;
  const [editing, setEditing] = useState(false);
  const [editState, editAction, editPending] = useActionState(
    updateLending,
    updateInitial,
  );
  const editRef = useRef<HTMLFormElement>(null);
  const { showToast } = useCenterToast();

  useToastOnActionError(editState.error, editPending, "Could not save loan");

  useEffect(() => {
    if (!editState.success) return;
    setEditing(false);
    showToast({ kind: "success", title: "Saved", timeoutMs: 1800 });
  }, [editState.success, showToast]);
  const paymentsPaidCount = payments.reduce(
    (s, p) => s + (p.installmentsCount ?? 1),
    0,
  );
  const estMonthly = estimatedPaymentPerMonthInfo(
    lending,
    remainingCents,
    paymentsPaidCount,
  );
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
        <div className="shrink-0 lg:self-start">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing((v) => !v);
              }}
              className="min-h-10 w-full touch-manipulation rounded-lg px-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 dark:active:bg-zinc-800 sm:w-auto sm:text-xs"
            >
              {editing ? "Cancel edit" : "Edit"}
            </button>
            <form action={deleteLending} className="sm:self-start">
              <input type="hidden" name="id" value={lending.id} />
              <button
                type="submit"
                className="min-h-10 w-full touch-manipulation rounded-lg px-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-rose-600 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-rose-400 dark:active:bg-zinc-800 sm:w-auto sm:text-xs"
              >
                Remove loan
              </button>
            </form>
          </div>
        </div>
      </div>

      {editing ? (
        <form
          ref={editRef}
          action={editAction}
          className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/30"
        >
          <input type="hidden" name="id" value={lending.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
              Counterparty name
              <input
                name="counterpartyName"
                required
                maxLength={120}
                defaultValue={lending.counterpartyName}
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                onBlur={(e) => {
                  e.currentTarget.value = formatTypedLabel(e.currentTarget.value);
                }}
              />
            </label>

            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Principal amount
              <input
                name="amount"
                required
                inputMode="decimal"
                defaultValue={centsToDecimalInput(lending.principalCents)}
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              />
              {paidCents > 0 ? (
                <span className="mt-1 block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                  Must be ≥ paid so far ({formatMoney(paidCents, c)})
                </span>
              ) : null}
            </label>

            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Currency
              <select
                name="currency"
                defaultValue={lending.currency ?? defaultCurrency}
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              >
                {SUPPORTED_CURRENCIES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Type
              <select
                name="kind"
                defaultValue={lending.kind}
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              >
                <option value="receivable">Receivable</option>
                <option value="payable">Payable</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Repayment
              <select
                name="repaymentStyle"
                defaultValue={lending.repaymentStyle}
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              >
                <option value="lump_sum">Lump sum</option>
                <option value="installment">Installment</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Total months / installments
              <input
                name="totalInstallments"
                inputMode="numeric"
                defaultValue={
                  lending.totalInstallments != null
                    ? String(lending.totalInstallments)
                    : ""
                }
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                placeholder="e.g. 12"
              />
            </label>

            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
              Start date
              <input
                name="startedAt"
                type="date"
                required
                defaultValue={dateInputValue(new Date(lending.startedAt))}
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </label>

            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
              Notes (optional)
              <textarea
                name="notes"
                rows={2}
                maxLength={2000}
                defaultValue={lending.notes ?? ""}
                className="mt-1 min-h-[4.5rem] w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-0 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                onBlur={(e) => {
                  e.currentTarget.value = formatTypedBlock(e.currentTarget.value);
                }}
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
              Linked credit-card borrowing tag (optional; receivable only)
              <select
                name="linkedCreditAccountId"
                defaultValue={lending.linkedCreditAccountId ?? ""}
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              >
                <option value="">—</option>
                {accountsList
                  .filter((a) => a.type === "bank" && a.bankKind === "credit")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
              <span className="mt-1 block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                When set, this receivable's remaining balance is excluded from total-expense
                computation.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={editPending}
            className="min-h-11 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:min-h-9 sm:w-auto sm:text-xs dark:bg-zinc-100 dark:text-zinc-900"
          >
            {editPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 sm:gap-2">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Principal</p>
          <p className="break-words font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatMoney(lending.principalCents, c)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Paid so far
            {lending.repaymentStyle === "installment" &&
            lending.totalInstallments != null
              ? ` · ${paymentsPaidCount}/${lending.totalInstallments}`
              : lending.repaymentStyle === "installment" && paymentsPaidCount > 0
                ? ` · ${paymentsPaidCount} payment${paymentsPaidCount === 1 ? "" : "s"}`
                : ""}
          </p>
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

      {estMonthly ? (
        <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/50 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/25">
          <p className="text-xs font-medium text-amber-900/90 dark:text-amber-100/90">
            Estimated payment / month
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatMoney(estMonthly.amountCents, c)}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
            Remaining balance ÷ {estMonthly.periodsLeft} period
            {estMonthly.periodsLeft === 1 ? "" : "s"} left in the plan (simple
            estimate, not amortized interest).
          </p>
        </div>
      ) : remainingCents > 0 &&
        lending.repaymentStyle === "installment" &&
        (lending.totalInstallments == null || lending.totalInstallments < 1) ? (
        <p className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/40 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100/90">
          Edit the loan and set total months/installments to see an estimated
          payment per month.
        </p>
      ) : remainingCents > 0 && lending.repaymentStyle === "lump_sum" ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Lump-sum loan: there is no scheduled monthly amount. The remaining
          balance is the amount still to pay.
        </p>
      ) : null}

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
      {lending.kind === "receivable" && lending.linkedCreditAccountId ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Tagged to a credit-card borrowed balance (excluded from total expenses).
        </p>
      ) : null}

      {payments.length > 0 ? (
        <ul className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Payments
          </p>
          {payments.map((p) => (
            <LendingPaymentListItem key={p.id} payment={p} currency={c} />
          ))}
        </ul>
      ) : null}

      <div className="mt-3">
        <LendingPaymentForm
          lendingId={lending.id}
          disabled={remainingCents <= 0}
          defaultDate={new Date().toISOString().slice(0, 10)}
          accountsList={accountsList}
        />
      </div>
    </li>
  );
}

export function LendingManager({
  items,
  defaultCurrency,
  accountsList,
}: {
  items: LendingWithPayments[];
  defaultCurrency: FiatCurrency;
  accountsList: { id: string; name: string; type: string; bankKind: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(
    createLending,
    createInitial,
  );
  const { showToast } = useCenterToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"receivable" | "payable">("receivable");
  const [repaymentStyle, setRepaymentStyle] = useState<
    "lump_sum" | "installment"
  >("lump_sum");

  useToastOnActionError(state.error, pending, "Could not add loan");

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    startTransition(() => {
      setKind("receivable");
      setRepaymentStyle("lump_sum");
    });
    showToast({ kind: "success", title: "Saved", timeoutMs: 2000 });
  }, [state.success, showToast]);

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
              value={repaymentStyle}
              onChange={(e) =>
                setRepaymentStyle(e.target.value as "lump_sum" | "installment")
              }
              className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-9 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="lump_sum">Lump sum (one payment)</option>
              <option value="installment">Installment (multiple payments)</option>
            </select>
          </label>

          {repaymentStyle === "installment" ? (
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Total months / installments
              <input
                name="totalInstallments"
                required
                inputMode="numeric"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-9 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                placeholder="e.g. 12 or 36"
              />
            </label>
          ) : (
            <input type="hidden" name="totalInstallments" value="" />
          )}

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

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300 sm:col-span-2">
            <p className="font-medium text-zinc-800 dark:text-zinc-100">
              Already paid (optional)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              If you already made repayments before adding this loan, record the total paid so far here. Optionally link it to an account so it appears in that account’s Transaction log.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Amount already paid
                <input
                  name="alreadyPaidAmount"
                  inputMode="decimal"
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                  placeholder="0.00"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Paid date
                <input
                  name="alreadyPaidAt"
                  type="date"
                  defaultValue={today}
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Installments already paid (optional)
                <input
                  name="alreadyPaidInstallments"
                  inputMode="numeric"
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                  placeholder="e.g. 3"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Account (optional)
                <select
                  name="alreadyPaidAccountId"
                  defaultValue=""
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 sm:min-h-9 sm:text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                >
                  <option value="">—</option>
                  {accountsList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

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
          {kind === "receivable" ? (
            <label className="block text-sm font-medium text-zinc-700 sm:col-span-2 dark:text-zinc-300">
              Linked credit-card borrowing tag (optional)
              <select
                name="linkedCreditAccountId"
                defaultValue=""
                className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-9 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              >
                <option value="">—</option>
                {accountsList
                  .filter((a) => a.type === "bank" && a.bankKind === "credit")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                Use this when someone used your credit card; their receivable remaining balance will
                be excluded from total-expense computation.
              </span>
            </label>
          ) : (
            <input type="hidden" name="linkedCreditAccountId" value="" />
          )}
        </div>

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
              <LendingCard
                key={row.lending.id}
                row={row}
                accountsList={accountsList}
                defaultCurrency={defaultCurrency}
              />
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
              <LendingCard
                key={row.lending.id}
                row={row}
                accountsList={accountsList}
                defaultCurrency={defaultCurrency}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
