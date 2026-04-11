"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { EodTrackerRow } from "@/app/actions/eod-tracker-rows";
import {
  createEodTradingAccount,
  deleteEodTradingAccount,
  updateEodTradingAccount,
  type EodTradingAccount,
} from "@/app/actions/eod-trading-accounts";
import { useCenterToast } from "@/components/center-toast";
import { buildTradingAccountSummaries } from "@/lib/eod-dashboard-aggregates";
import { centsToInputString, formatUsdFromCents, parseUsdToCents } from "@/lib/eod-money";

function BrokerIcon({ name }: { name: string }) {
  const ch = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      aria-hidden
    >
      {ch}
    </span>
  );
}

export function TradingAccountsSection({
  rows,
  tradingAccounts,
}: {
  rows: EodTrackerRow[];
  tradingAccounts: EodTradingAccount[];
}) {
  const router = useRouter();
  const [manageOpen, setManageOpen] = useState(false);
  const summaries = useMemo(
    () => buildTradingAccountSummaries(rows, tradingAccounts),
    [rows, tradingAccounts],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="max-w-xl text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Balance uses <strong className="text-zinc-800 dark:text-zinc-300">initial capital</strong>{" "}
          plus summed <strong className="text-zinc-800 dark:text-zinc-300">logged net P&amp;L</strong>{" "}
          on journal rows linked to each account. ROI uses the same profit total.
        </p>
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="touch-manipulation rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Manage accounts
        </button>
      </div>

      {tradingAccounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No trading accounts yet. Add Binance, Bybit, or paper buckets, then link journal rows to
          them.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/90">
          <table className="w-full min-w-[44rem] border-collapse text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2.5">Broker</th>
                <th className="px-3 py-2.5 text-right">Balance</th>
                <th className="px-3 py-2.5 text-right">Profit (net)</th>
                <th className="px-3 py-2.5 text-right">Win rate</th>
                <th className="px-3 py-2.5 text-right">ROI</th>
                <th className="px-3 py-2.5 text-right">Trades</th>
                <th className="px-3 py-2.5 text-right">Initial</th>
              </tr>
            </thead>
            <tbody className="text-zinc-800 dark:text-zinc-200">
              {summaries.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/80"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <BrokerIcon name={s.name} />
                      <span className="font-medium">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {formatUsdFromCents(s.balanceCents)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                      s.profitCents > 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : s.profitCents < 0
                          ? "text-red-700 dark:text-red-400"
                          : ""
                    }`}
                  >
                    {formatUsdFromCents(s.profitCents)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {s.winRatePercent === null ? "—" : `${s.winRatePercent.toFixed(0)}%`}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {s.roiPercent === null ? "—" : `${s.roiPercent.toFixed(1)}%`}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{s.totalTrades}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                    {formatUsdFromCents(s.initialCapitalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {manageOpen ? (
        <ManageTradingAccountsModal
          accounts={tradingAccounts}
          onClose={() => setManageOpen(false)}
          onChanged={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

function ManageTradingAccountsModal({
  accounts,
  onClose,
  onChanged,
}: {
  accounts: EodTradingAccount[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useCenterToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [initialUsd, setInitialUsd] = useState("100.00");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editInitialUsd, setEditInitialUsd] = useState("");

  const startEdit = (a: EodTradingAccount) => {
    setDeleteArmedId(null);
    setEditingId(a.id);
    setEditName(a.name);
    setEditInitialUsd(centsToInputString(a.initialCapitalCents));
  };

  const add = () => {
    const cents = parseUsdToCents(initialUsd);
    if (cents === null || cents < 0) {
      showToast({
        kind: "error",
        title: "Invalid starting balance",
        message: "Enter a valid USD amount (zero or positive).",
        timeoutMs: 4200,
      });
      return;
    }
    startTransition(async () => {
      const res = await createEodTradingAccount({ name: name.trim(), initialCapitalCents: cents });
      if ("error" in res) {
        showToast({
          kind: "error",
          title: "Could not add account",
          message: res.error,
          timeoutMs: 6500,
        });
        return;
      }
      setName("");
      setInitialUsd("100.00");
      onChanged();
    });
  };

  const saveEdit = (id: string) => {
    const cents = parseUsdToCents(editInitialUsd);
    if (cents === null || cents < 0) {
      showToast({
        kind: "error",
        title: "Invalid starting balance",
        message: "Enter a valid USD amount (zero or positive).",
        timeoutMs: 4200,
      });
      return;
    }
    startTransition(async () => {
      const res = await updateEodTradingAccount(id, {
        name: editName.trim(),
        initialCapitalCents: cents,
      });
      if ("error" in res) {
        showToast({
          kind: "error",
          title: "Could not update account",
          message: res.error,
          timeoutMs: 6500,
        });
        return;
      }
      setEditingId(null);
      onChanged();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deleteEodTradingAccount(id);
      if ("error" in res) {
        showToast({
          kind: "error",
          title: "Could not delete account",
          message: res.error,
          timeoutMs: 6500,
        });
        setDeleteArmedId(null);
        return;
      }
      setDeleteArmedId(null);
      if (editingId === id) setEditingId(null);
      showToast({
        kind: "success",
        title: "Account removed",
        message: "Linked journal rows were unlinked.",
        timeoutMs: 2800,
      });
      onChanged();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="manage-trading-accounts-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2
            id="manage-trading-accounts-title"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Trading accounts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="mb-4 space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            New account
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Broker name (e.g. Binance)"
            className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <label className="flex flex-col gap-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            Initial capital (USD)
            <input
              value={initialUsd}
              onChange={(e) => setInitialUsd(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <button
            type="button"
            disabled={pending || !name.trim()}
            onClick={add}
            className="h-10 w-full rounded-lg bg-zinc-900 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add account
          </button>
        </div>

        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              {editingId === a.id ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <input
                    value={editInitialUsd}
                    onChange={(e) => setEditInitialUsd(e.target.value)}
                    className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => saveEdit(a.id)}
                      className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{a.name}</div>
                    <div className="font-mono text-[11px] text-zinc-500">
                      Initial {formatUsdFromCents(a.initialCapitalCents)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-600"
                    >
                      Edit
                    </button>
                    {deleteArmedId === a.id ? (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setDeleteArmedId(null)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => remove(a.id)}
                          className="rounded-md border border-red-400 bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          {pending ? "…" : "Confirm delete"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setDeleteArmedId(a.id)}
                        className="rounded-md border border-red-300 px-2 py-1 text-[11px] text-red-700 dark:border-red-900/50 dark:text-red-300"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
