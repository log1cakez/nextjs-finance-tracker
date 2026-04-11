"use client";

import { useMemo, useState } from "react";
import type { EodTrackerRow } from "@/app/actions/eod-tracker-rows";
import type { EodTradingAccount } from "@/app/actions/eod-trading-accounts";
import {
  attachWeekStats,
  calendarWeekGrid,
  dailyPnLForMonth,
  monthNetPnlCents,
  monthTradedDaysCount,
} from "@/lib/eod-dashboard-aggregates";
import { formatUsdFromCents } from "@/lib/eod-money";

const DISPLAY_LOCALE = "en-US";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function shiftMonth(ym: string, delta: number): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y!, m! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(DISPLAY_LOCALE, {
    month: "long",
    year: "numeric",
  });
}

export function PnlCalendar({
  rows,
  tradingAccounts,
  initialMonth,
  serverToday,
}: {
  rows: EodTrackerRow[];
  tradingAccounts: EodTradingAccount[];
  initialMonth: string;
  /** YYYY-MM-DD for highlighting "today" consistently with the server render. */
  serverToday: string;
}) {
  const [calendarMonth, setCalendarMonth] = useState(initialMonth);
  const [accountFilter, setAccountFilter] = useState<string | "all">("all");

  const daily = useMemo(
    () => dailyPnLForMonth(rows, calendarMonth, accountFilter),
    [rows, calendarMonth, accountFilter],
  );

  const weeks = useMemo(() => {
    const base = calendarWeekGrid(calendarMonth);
    return attachWeekStats(base, daily, rows, calendarMonth, accountFilter);
  }, [calendarMonth, daily, rows, accountFilter]);

  const monthTotal = useMemo(
    () => monthNetPnlCents(rows, calendarMonth, accountFilter),
    [rows, calendarMonth, accountFilter],
  );

  const tradedDays = useMemo(
    () => monthTradedDaysCount(rows, calendarMonth, accountFilter),
    [rows, calendarMonth, accountFilter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}
            className="touch-manipulation rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Previous month"
          >
            ←
          </button>
          <h2 className="min-w-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {monthTitle(calendarMonth)}
          </h2>
          <button
            type="button"
            onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}
            className="touch-manipulation rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Next month"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setCalendarMonth(serverToday.slice(0, 7))}
            className="touch-manipulation rounded-lg border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200"
          >
            Today
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            Account
            <select
              value={accountFilter}
              onChange={(e) =>
                setAccountFilter(e.target.value === "all" ? "all" : e.target.value)
              }
              className="h-9 min-h-9 max-w-[11rem] rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="all">All accounts</option>
              {tradingAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
              Month net: {formatUsdFromCents(monthTotal)}
            </span>
            <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-800 dark:text-violet-200">
              Logged P&amp;L days: {tradedDays}
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        <div className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950/90 sm:p-3">
          <div
            className="grid text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500"
            style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          >
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-0.5 py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 space-y-1">
            {weeks.map((w) => (
              <div
                key={w.weekIndex}
                className="grid gap-1"
                style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
              >
                {w.cells.map((c) => {
                  const stats = daily.get(c.dateKey);
                  const pnl = stats?.pnlCents ?? 0;
                  const trades = stats?.tradeCount ?? 0;
                  const wins = stats?.wins ?? 0;
                  const winRate = trades > 0 ? Math.round((wins / trades) * 100) : null;
                  const isToday = c.dateKey === serverToday;
                  const anyPnlLogged = rows.some(
                    (r) =>
                      (accountFilter === "all" || r.tradingAccountId === accountFilter) &&
                      r.tradeDate.slice(0, 10) === c.dateKey &&
                      r.netPnlCents !== null,
                  );
                  const tone =
                    !c.inMonth
                      ? "muted"
                      : pnl > 0
                        ? "win"
                        : pnl < 0
                          ? "loss"
                          : anyPnlLogged
                            ? "flat"
                            : "empty";
                  const toneClass =
                    tone === "win"
                      ? "border-emerald-500/35 bg-emerald-500/10"
                      : tone === "loss"
                        ? "border-red-500/35 bg-red-500/10"
                        : tone === "flat"
                          ? "border-zinc-300 bg-zinc-100/80 dark:border-zinc-600 dark:bg-zinc-800/50"
                          : tone === "muted"
                            ? "border-transparent bg-zinc-50/60 opacity-60 dark:bg-zinc-900/40"
                            : "border-zinc-200/80 bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900/30";

                  return (
                    <div
                      key={c.dateKey}
                      className={`relative flex min-h-[4.5rem] flex-col rounded-lg border px-1 py-1 text-left text-[10px] leading-tight sm:min-h-[5.25rem] sm:px-1.5 sm:py-1.5 ${toneClass}`}
                    >
                      <span
                        className={`absolute right-1 top-1 font-mono tabular-nums text-[10px] ${
                          isToday
                            ? "flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white"
                            : c.inMonth
                              ? "text-zinc-600 dark:text-zinc-400"
                              : "text-zinc-400 dark:text-zinc-600"
                        }`}
                      >
                        {c.dayOfMonth}
                      </span>
                      {c.inMonth && trades > 0 ? (
                        <div className="mt-4 flex flex-col gap-0.5 pr-4">
                          <span
                            className={`font-semibold tabular-nums ${
                              pnl > 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : pnl < 0
                                  ? "text-red-700 dark:text-red-400"
                                  : "text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {anyPnlLogged ? formatUsdFromCents(pnl) : "—"}
                          </span>
                          <span className="text-zinc-500 dark:text-zinc-500">
                            {trades} {trades === 1 ? "trade" : "trades"}
                          </span>
                          {winRate !== null ? (
                            <span className="text-zinc-500 dark:text-zinc-500">{winRate}% day WR</span>
                          ) : null}
                        </div>
                      ) : c.inMonth ? (
                        <span className="mt-6 text-zinc-400 dark:text-zinc-600"> </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex w-[5.5rem] shrink-0 flex-col gap-1 sm:w-24">
          <div className="h-6 sm:h-7" />
          {weeks.map((w) => (
            <div
              key={`wsum-${w.weekIndex}`}
              className="flex min-h-[4.5rem] flex-col justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-1 py-1 text-[10px] dark:border-zinc-800 dark:bg-zinc-900/80 sm:min-h-[5.25rem] sm:px-1.5"
            >
              <div className="font-semibold text-zinc-500">W{w.weekIndex}</div>
              <div
                className={`font-semibold tabular-nums ${
                  w.weekPnlCents > 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : w.weekPnlCents < 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {formatUsdFromCents(w.weekPnlCents)}
              </div>
              <div className="text-violet-700 dark:text-violet-300">{w.weekTradedDays}d</div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
        Day cells sum <strong className="text-zinc-700 dark:text-zinc-400">net P&amp;L</strong> from
        journal rows in the filter. Days with trades but no dollar amount stay neutral until you log
        net P&amp;L on the row.
      </p>
    </div>
  );
}
