"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createFinancialAccount,
  deleteFinancialAccount,
  updateCreditAccountDetails,
  updateFinancialAccountBasics,
  updateBankCreditSettings,
  type FinancialAccountActionState,
  type FinancialAccountWithUsage,
  type UpdateAccountBasicsActionState,
  type UpdateCreditAccountDetailsActionState,
  type UpdateCreditActionState,
} from "@/app/actions/financial-accounts";
import { AccountTransactionLogModal } from "@/components/recent-transactions-log-modal";
import {
  useCenterToast,
  useToastOnActionError,
} from "@/components/center-toast";
import {
  FINANCE_ACCOUNT_LABELS,
  FINANCE_ACCOUNT_TYPE_ORDER,
  type FinanceAccountKind,
} from "@/lib/financial-account-labels";
import {
  formatMoney,
  SUPPORTED_CURRENCIES,
  type FiatCurrency,
} from "@/lib/money";
import { formatTypedLabel } from "@/lib/typed-label-format";

const initial: FinancialAccountActionState = {};
const creditUpdateInitial: UpdateCreditActionState = {};
const accountBasicsInitial: UpdateAccountBasicsActionState = {};
const creditAccountDetailsInitial: UpdateCreditAccountDetailsActionState = {};

function centsToDecimalInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function ordinalDay(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function BankActivityLine({
  netCents,
  currency,
}: {
  netCents: number;
  currency: FiatCurrency;
}) {
  return (
    <p className="mt-2 text-xs leading-snug text-zinc-600 dark:text-zinc-400">
      <span className="font-medium text-zinc-800 dark:text-zinc-200">
        Remaining balance ({currency})
      </span>
      : {formatMoney(netCents, currency)}
    </p>
  );
}

function CreditScheduleLine({
  statementDay,
  paymentDay,
}: {
  statementDay: number | null;
  paymentDay: number | null;
}) {
  if (statementDay == null && paymentDay == null) return null;
  const parts: string[] = [];
  if (statementDay != null) {
    parts.push(`Statement closes ${ordinalDay(statementDay)}`);
  }
  if (paymentDay != null) {
    parts.push(`Payment due ${ordinalDay(paymentDay)}`);
  }
  return (
    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{parts.join(" · ")}</p>
  );
}

function CreditUsageBar({
  usedCents,
  limitCents,
  currency,
}: {
  usedCents: number;
  limitCents: number;
  currency: FiatCurrency;
}) {
  const pct =
    limitCents > 0 ? Math.min(100, Math.round((usedCents / limitCents) * 100)) : 0;
  const over = usedCents > limitCents;
  const remaining = Math.max(0, limitCents - usedCents);
  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap justify-between gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          Used {formatMoney(usedCents, currency)} / limit {formatMoney(limitCents, currency)}
        </span>
        {over ? (
          <span className="font-medium text-rose-600 dark:text-rose-400">Over limit</span>
        ) : null}
      </div>
      <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
        Remaining available: {formatMoney(remaining, currency)}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-[width] ${
            over
              ? "bg-rose-500 dark:bg-rose-400"
              : "bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-500 dark:to-amber-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
        New charges (expenses) in {currency} increase usage. Card bill payments marked when
        you log, transfers to this card, and income on the card reduce it; transfers from it
        increase it.
      </p>
    </div>
  );
}

function BankCreditEditForm({
  account,
}: {
  account: FinancialAccountWithUsage;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateBankCreditSettings,
    creditUpdateInitial,
  );
  const { showToast } = useCenterToast();
  const formRef = useRef<HTMLFormElement>(null);

  useToastOnActionError(state.error, pending, "Could not save credit settings");

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setOpen(false);
      showToast({ kind: "success", title: "Saved", timeoutMs: 1800 });
    }
  }, [state.success, showToast]);

  if (
    account.type !== "bank" ||
    account.bankKind !== "credit" ||
    account.creditLimitCents == null ||
    account.creditLimitCurrency == null
  ) {
    return null;
  }

  const cur = account.creditLimitCurrency as FiatCurrency;

  return (
    <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        {open ? "Cancel edit" : "Edit credit settings"}
      </button>
      {open ? (
        <form
          ref={formRef}
          action={formAction}
          className="mt-3 space-y-3"
        >
          <input type="hidden" name="id" value={account.id} />
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Credit limit
            <input
              name="creditLimit"
              required
              inputMode="decimal"
              defaultValue={centsToDecimalInput(account.creditLimitCents)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Starting balance owed (optional)
            <input
              name="creditOpening"
              inputMode="decimal"
              defaultValue={
                account.creditOpeningBalanceCents > 0
                  ? centsToDecimalInput(account.creditOpeningBalanceCents)
                  : ""
              }
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Limit currency
            <select
              name="creditLimitCurrency"
              defaultValue={cur}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Statement date
              <input
                name="creditStatementDay"
                type="number"
                min={1}
                max={31}
                placeholder="1–31"
                defaultValue={account.creditStatementDayOfMonth ?? ""}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              />
              <span className="mt-0.5 block text-[10px] font-normal text-zinc-400">
                Day statement closes
              </span>
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Payment due
              <input
                name="creditPaymentDueDay"
                type="number"
                min={1}
                max={31}
                placeholder="1–31"
                defaultValue={account.creditPaymentDueDayOfMonth ?? ""}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              />
              <span className="mt-0.5 block text-[10px] font-normal text-zinc-400">
                Due day of month
              </span>
            </label>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function AccountBasicsEditForm({
  account,
  defaultCurrency,
}: {
  account: FinancialAccountWithUsage;
  defaultCurrency: FiatCurrency;
}) {
  const [open, setOpen] = useState(false);
  const isCreditCard = account.type === "bank" && account.bankKind === "credit";
  const [state, formAction, pending] = useActionState(
    isCreditCard ? updateCreditAccountDetails : updateFinancialAccountBasics,
    isCreditCard ? creditAccountDetailsInitial : accountBasicsInitial,
  );
  const { showToast } = useCenterToast();
  const formRef = useRef<HTMLFormElement>(null);

  useToastOnActionError(state.error, pending, "Could not save account");

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      showToast({ kind: "success", title: "Saved", timeoutMs: 1800 });
    }
  }, [state.success, showToast]);

  return (
    <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        {open ? "Cancel edit" : "Edit account"}
      </button>
      {open ? (
        <form ref={formRef} action={formAction} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={account.id} />
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Name
            <input
              name="name"
              required
              defaultValue={account.name}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
              onBlur={(e) => {
                e.currentTarget.value = formatTypedLabel(e.currentTarget.value);
              }}
            />
          </label>
          {!isCreditCard ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Set current balance now (optional)
                <input
                  name="heldAmount"
                  inputMode="decimal"
                  defaultValue={
                    account.openingBalanceCents != null
                      ? centsToDecimalInput(account.openingBalanceCents)
                      : ""
                  }
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                />
                <span className="mt-1 block text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                  We’ll recompute the starting balance based on your existing activity.
                </span>
              </label>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Balance currency
                <select
                  name="heldCurrency"
                  defaultValue={account.openingBalanceCurrency ?? defaultCurrency}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Credit limit
                <input
                  name="creditLimit"
                  required
                  inputMode="decimal"
                  defaultValue={
                    account.creditLimitCents != null
                      ? centsToDecimalInput(account.creditLimitCents)
                      : ""
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Starting balance owed (optional)
                  <input
                    name="creditOpening"
                    inputMode="decimal"
                    defaultValue={
                      account.creditOpeningBalanceCents > 0
                        ? centsToDecimalInput(account.creditOpeningBalanceCents)
                        : ""
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                </label>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Limit currency
                  <select
                    name="creditLimitCurrency"
                    defaultValue={account.creditLimitCurrency ?? defaultCurrency}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Statement date
                  <input
                    name="creditStatementDay"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={account.creditStatementDayOfMonth ?? ""}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                </label>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Payment due
                  <input
                    name="creditPaymentDueDay"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={account.creditPaymentDueDayOfMonth ?? ""}
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                </label>
              </div>
            </>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function AccountManager({
  items,
  defaultCurrency,
}: {
  items: FinancialAccountWithUsage[];
  defaultCurrency: FiatCurrency;
}) {
  const [state, formAction, pending] = useActionState(
    createFinancialAccount,
    initial,
  );
  const { showToast } = useCenterToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [accountType, setAccountType] = useState<FinanceAccountKind>("bank");
  const [bankKind, setBankKind] = useState<"debit" | "credit">("debit");

  useToastOnActionError(state.error, pending, "Could not add account");

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setAccountType("bank");
      setBankKind("debit");
      showToast({ kind: "success", title: "Account added", timeoutMs: 2200 });
    }
  }, [state.success, showToast]);

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
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 sm:p-6"
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
              placeholder="Chase Checking, Visa, Coinbase…"
              onBlur={(e) => {
                e.currentTarget.value = formatTypedLabel(e.currentTarget.value);
              }}
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:w-52">
            Type
            <select
              name="type"
              value={accountType}
              onChange={(e) =>
                setAccountType(e.target.value as FinanceAccountKind)
              }
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

        {accountType === "bank" ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Bank account
            </legend>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-zinc-700 sm:min-h-0 dark:text-zinc-300">
                <input
                  type="radio"
                  name="bankKind"
                  value="debit"
                  checked={bankKind === "debit"}
                  onChange={() => setBankKind("debit")}
                  className="h-5 w-5 border-zinc-300 text-amber-600 focus:ring-amber-500 sm:h-4 sm:w-4 dark:border-zinc-600"
                />
                Debit (checking / savings)
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-zinc-700 sm:min-h-0 dark:text-zinc-300">
                <input
                  type="radio"
                  name="bankKind"
                  value="credit"
                  checked={bankKind === "credit"}
                  onChange={() => setBankKind("credit")}
                  className="h-5 w-5 border-zinc-300 text-amber-600 focus:ring-amber-500 sm:h-4 sm:w-4 dark:border-zinc-600"
                />
                Credit card
              </label>
            </div>
          </fieldset>
        ) : null}

        {accountType !== "bank" || bankKind === "debit" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Current balance when you started tracking (optional)
              <input
                name="heldAmount"
                inputMode="decimal"
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                placeholder="How much this account holds today"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Balance currency
              <select
                name="heldCurrency"
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
          </div>
        ) : null}

        {accountType === "bank" && bankKind === "credit" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-700 sm:col-span-2 dark:text-zinc-300">
              Credit limit
              <input
                name="creditLimit"
                required
                inputMode="decimal"
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                placeholder="0.00"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Limit currency
              <select
                name="creditLimitCurrency"
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
              Starting balance owed (optional)
              <input
                name="creditOpening"
                inputMode="decimal"
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                placeholder="0.00 if new card"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Statement date
              <input
                name="creditStatementDay"
                type="number"
                min={1}
                max={31}
                placeholder="Day 1–31"
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
              <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                Day of month the billing cycle closes
              </span>
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Payment due date
              <input
                name="creditPaymentDueDay"
                type="number"
                min={1}
                max={31}
                placeholder="Day 1–31"
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
              <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                Day of month payment is due
              </span>
            </label>
          </div>
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
              <ul className="mt-3 space-y-3">
                {group.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                            {a.name}
                          </span>
                          {a.type === "bank" && a.bankKind ? (
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                a.bankKind === "credit"
                                  ? "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
                                  : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              }`}
                            >
                              {a.bankKind === "credit" ? "Credit" : "Debit"}
                            </span>
                          ) : null}
                        </div>
                        {a.type === "bank" &&
                        a.bankKind === "credit" &&
                        a.creditLimitCents != null &&
                        a.creditLimitCurrency != null &&
                        typeof a.usedCreditCents === "number" ? (
                          <CreditUsageBar
                            usedCents={a.usedCreditCents}
                            limitCents={a.creditLimitCents}
                            currency={a.creditLimitCurrency as FiatCurrency}
                          />
                        ) : null}
                        {typeof a.activityNetCents === "number" &&
                        a.activityCurrency ? (
                          <BankActivityLine
                            netCents={a.activityNetCents}
                            currency={a.activityCurrency}
                          />
                        ) : null}
                        {a.type === "bank" &&
                        a.bankKind === "credit" &&
                        (a.creditStatementDayOfMonth != null ||
                          a.creditPaymentDueDayOfMonth != null) ? (
                          <CreditScheduleLine
                            statementDay={a.creditStatementDayOfMonth}
                            paymentDay={a.creditPaymentDueDayOfMonth}
                          />
                        ) : null}
                        <AccountBasicsEditForm
                          account={a}
                          defaultCurrency={defaultCurrency}
                        />
                        {!(
                          a.type === "bank" && a.bankKind === "credit"
                        ) ? <BankCreditEditForm account={a} /> : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <AccountTransactionLogModal
                          accountId={a.id}
                          accountName={a.name}
                        />
                        <form action={deleteFinancialAccount}>
                          <input type="hidden" name="id" value={a.id} />
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
    </div>
  );
}
