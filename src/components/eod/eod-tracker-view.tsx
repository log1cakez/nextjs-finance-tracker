"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import type { EodTrackerRow } from "@/app/actions/eod-tracker-rows";
import type { EodTradingAccount } from "@/app/actions/eod-trading-accounts";
import { AddEodLauncher } from "@/components/eod/add-eod-launcher";
import { EodAiAnalyticsPanel } from "@/components/eod/eod-ai-analytics-panel";
import { EodAnalyticsCharts } from "@/components/eod/eod-analytics-charts";
import { EodRowManageActions } from "@/components/eod/eod-row-manage-actions";
import { PnlCalendar } from "@/components/eod/pnl-calendar";
import { TradingAccountsSection } from "@/components/eod/trading-accounts-section";
import { EOD_SECTION_IDS } from "@/lib/eod-section-ids";
import { eodMonthJournalDataStamp } from "@/lib/eod-journal-month-stamp";
import type { EodPillTone } from "@/lib/eod-tracker-options";
import { eodPillClass, getEodOptionTone } from "@/lib/eod-tracker-options";
import { formatUsdFromCents } from "@/lib/eod-money";

/** Fixed locale so SSR and client match (avoids hydration mismatch on dates). */
const EOD_DISPLAY_LOCALE = "en-US";
const MULTI_VALUE_DELIMITER = "|";

function splitMultiValue(raw: string): string[] {
  return raw
    .split(MULTI_VALUE_DELIMITER)
    .map((x) => x.trim())
    .filter(Boolean);
}

function rowYearMonth(row: EodTrackerRow): string {
  return row.tradeDate.slice(0, 7);
}

type EodSortColumn =
  | "weekday"
  | "broker"
  | "session"
  | "timeframeEof"
  | "poi"
  | "trend"
  | "position"
  | "riskType"
  | "result"
  | "pnl"
  | "rrr"
  | "timeRange"
  | "entryTf"
  | "remarks"
  | "notion"
  | "date";

type SortDir = "asc" | "desc";
type SortRule = { column: EodSortColumn; dir: SortDir };

/** At most one primary + one secondary sort column (Shift+click adds secondary). */
const MAX_SORT_RULES = 2;

function capSortRules(rules: SortRule[]): SortRule[] {
  return rules.slice(0, MAX_SORT_RULES);
}

function defaultDirFor(column: EodSortColumn): SortDir {
  if (column === "weekday") return "asc";
  if (column === "date") return "desc";
  if (column === "pnl") return "desc";
  return "asc";
}

/** 0 = Monday … 6 = Sunday (ISO-style week). Uses local calendar day of `tradeDate`. */
function weekdayIndexMondayFirst(tradeDateIso: string): number {
  const dow = new Date(tradeDateIso).getDay();
  return dow === 0 ? 6 : dow - 1;
}

function rowComparableString(row: EodTrackerRow, column: EodSortColumn): string {
  switch (column) {
    case "broker":
      return row.tradingAccountName ?? "";
    case "session":
      return row.session;
    case "timeframeEof":
      return row.timeframeEof.join(", ");
    case "poi":
      return row.poi.join(", ");
    case "trend":
      return row.trend;
    case "position":
      return row.position;
    case "riskType":
      return row.riskType;
    case "result":
      return row.result.join(", ");
    case "rrr":
      return row.rrr;
    case "timeRange":
      return row.timeRange;
    case "entryTf":
      return row.entryTf;
    case "remarks":
      return row.remarks;
    case "notion":
      return row.notionUrl.trim();
    default:
      return "";
  }
}

function compareRows(
  a: EodTrackerRow,
  b: EodTrackerRow,
  column: EodSortColumn,
  dir: SortDir,
): number {
  const sign = dir === "asc" ? 1 : -1;
  let delta = 0;
  if (column === "weekday") {
    delta = weekdayIndexMondayFirst(a.tradeDate) - weekdayIndexMondayFirst(b.tradeDate);
    if (delta === 0) {
      delta = new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime();
    }
  } else if (column === "date") {
    delta = new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime();
  } else if (column === "pnl") {
    if (a.netPnlCents === null && b.netPnlCents === null) {
      delta = 0;
    } else if (a.netPnlCents === null) {
      return 1;
    } else if (b.netPnlCents === null) {
      return -1;
    } else {
      delta = a.netPnlCents - b.netPnlCents;
    }
  } else if (column === "notion") {
    const ha = a.notionUrl.trim() ? 1 : 0;
    const hb = b.notionUrl.trim() ? 1 : 0;
    delta = ha - hb;
    if (delta === 0) {
      delta = a.notionUrl.trim().localeCompare(b.notionUrl.trim(), undefined, {
        sensitivity: "base",
      });
    }
  } else {
    const sa = rowComparableString(a, column);
    const sb = rowComparableString(b, column);
    delta = sa.localeCompare(sb, undefined, { sensitivity: "base" });
  }
  if (delta !== 0) return sign * (delta < 0 ? -1 : 1);
  return a.id.localeCompare(b.id);
}

function PillList({
  items,
  fieldKey,
  align = "center",
}: {
  items: string[];
  fieldKey: string;
  align?: "center" | "start";
}) {
  if (items.length === 0) {
    return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
  }
  return (
    <div
      className={`flex w-full min-w-0 flex-row flex-wrap gap-1 ${align === "start" ? "justify-start" : "justify-center"}`}
    >
      {items.map((v) => (
        <span
          key={v}
          className={eodPillClass(getEodOptionTone(fieldKey, v) as EodPillTone)}
        >
          {v}
        </span>
      ))}
    </div>
  );
}

function PillOne({ value, fieldKey }: { value: string; fieldKey: string }) {
  if (!value) {
    return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
  }
  return (
    <span className={eodPillClass(getEodOptionTone(fieldKey, value) as EodPillTone)}>
      {value}
    </span>
  );
}

function FieldLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-zinc-200/90 pb-2 last:border-b-0 last:pb-0 dark:border-zinc-800/80">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      <div className="text-left text-xs text-zinc-800 dark:text-zinc-200">{children}</div>
    </div>
  );
}

function EodMobileRowCard({
  row,
  tradingAccounts,
}: {
  row: EodTrackerRow;
  tradingAccounts: EodTradingAccount[];
}) {
  const dt = new Date(row.tradeDate);
  const weekday = dt.toLocaleDateString(EOD_DISPLAY_LOCALE, { weekday: "long" });
  const dateLabel = dt.toLocaleDateString(EOD_DISPLAY_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <PillOne value={weekday} fieldKey="weekday" />
          <span className="text-xs text-zinc-600 dark:text-zinc-400">{dateLabel}</span>
        </div>
        <EodRowManageActions
          rowId={row.id}
          tradingAccounts={tradingAccounts}
          initial={{
            tradeDate: row.tradeDate.slice(0, 10),
            session: row.session,
            timeframeEof: row.timeframeEof,
            poi: row.poi,
            trend: row.trend,
            position: row.position,
            riskType: row.riskType,
            result: row.result,
            rrr: row.rrr,
            timeRange: row.timeRange,
            entryTf: row.entryTf,
            remarks: row.remarks,
            notionUrl: row.notionUrl,
            tradingAccountId: row.tradingAccountId,
            netPnlCents: row.netPnlCents,
          }}
        />
      </div>
      <div className="space-y-2.5">
        <FieldLine label="Account">
          {row.tradingAccountName ? (
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{row.tradingAccountName}</span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">—</span>
          )}
        </FieldLine>
        <FieldLine label="Net P&amp;L">
          {row.netPnlCents === null ? (
            <span className="text-zinc-400 dark:text-zinc-500">—</span>
          ) : (
            <span className="font-mono tabular-nums">{formatUsdFromCents(row.netPnlCents)}</span>
          )}
        </FieldLine>
        <FieldLine label="Session">
          <PillList items={splitMultiValue(row.session)} fieldKey="session" align="start" />
        </FieldLine>
        <FieldLine label="Timeframe EOF">
          <PillList items={row.timeframeEof} fieldKey="timeframeEof" align="start" />
        </FieldLine>
        <FieldLine label="Point of interest">
          <PillList items={row.poi} fieldKey="poi" align="start" />
        </FieldLine>
        <FieldLine label="Trend">
          <PillList items={splitMultiValue(row.trend)} fieldKey="trend" align="start" />
        </FieldLine>
        <FieldLine label="Position">
          <PillList items={splitMultiValue(row.position)} fieldKey="position" align="start" />
        </FieldLine>
        <FieldLine label="Risk">
          <PillList items={splitMultiValue(row.riskType)} fieldKey="riskType" align="start" />
        </FieldLine>
        <FieldLine label="Result">
          <PillList items={row.result} fieldKey="result" align="start" />
        </FieldLine>
        <FieldLine label="RRR">
          <PillList items={splitMultiValue(row.rrr)} fieldKey="rrr" align="start" />
        </FieldLine>
        <FieldLine label="Time">
          {row.timeRange ? (
            <span className="whitespace-pre-wrap font-mono text-zinc-700 dark:text-zinc-300">
              {row.timeRange}
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">—</span>
          )}
        </FieldLine>
        <FieldLine label="Entry TF">
          <PillList items={splitMultiValue(row.entryTf)} fieldKey="entryTf" align="start" />
        </FieldLine>
        <FieldLine label="Remarks">
          {row.remarks ? (
            <span className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{row.remarks}</span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">—</span>
          )}
        </FieldLine>
        <FieldLine label="Notion">
          {row.notionUrl.trim() ? (
            <a
              href={row.notionUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center font-medium text-amber-700 underline underline-offset-2 touch-manipulation dark:text-amber-400"
            >
              Open link
            </a>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">—</span>
          )}
        </FieldLine>
      </div>
    </li>
  );
}

const SORTABLE: { column: EodSortColumn; label: string }[] = [
  { column: "weekday", label: "Weekday" },
  { column: "broker", label: "Account" },
  { column: "session", label: "Session" },
  { column: "timeframeEof", label: "Timeframe EOF" },
  { column: "poi", label: "Point of Interest" },
  { column: "trend", label: "Trend" },
  { column: "position", label: "Pos." },
  { column: "riskType", label: "Risk" },
  { column: "result", label: "Result" },
  { column: "pnl", label: "Net P&L" },
  { column: "rrr", label: "RRR" },
  { column: "timeRange", label: "Time" },
  { column: "entryTf", label: "Entry" },
  { column: "remarks", label: "Remarks" },
  { column: "notion", label: "Notion" },
  { column: "date", label: "Date" },
];

function SortableTh({
  column,
  label,
  sortRules,
  onSort,
}: {
  column: EodSortColumn;
  label: string;
  sortRules: SortRule[];
  onSort: (c: EodSortColumn, additive: boolean) => void;
}) {
  const activeIdx = sortRules.findIndex((r) => r.column === column);
  const active = activeIdx >= 0;
  const activeRule = active ? sortRules[activeIdx] : null;
  const isPrimary = activeIdx === 0;
  return (
    <th
      className="min-w-[5.5rem]"
      aria-sort={
        isPrimary && activeRule
          ? activeRule.dir === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        onClick={(e) => onSort(column, e.shiftKey)}
        className="mx-auto flex w-full max-w-full touch-manipulation flex-col items-center gap-0.5 rounded-md px-1 py-0.5 text-center hover:bg-zinc-200/80 dark:hover:bg-zinc-800/50 sm:flex-row sm:justify-center sm:gap-1"
      >
        <span className="leading-none">{label}</span>
        <span
          className="inline-flex h-4 min-w-[1.25rem] items-center justify-center font-mono text-[10px] tabular-nums text-amber-700 dark:text-amber-400/90"
          aria-hidden
        >
          {active && activeRule ? (
            <>
              {activeRule.dir === "asc" ? "▲" : "▼"}
              {sortRules.length > 1 ? activeIdx + 1 : ""}
            </>
          ) : (
            "\u00a0"
          )}
        </span>
      </button>
    </th>
  );
}

function monthLabel(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y!, m! - 1, 1);
  return d.toLocaleDateString(EOD_DISPLAY_LOCALE, { month: "long", year: "numeric" });
}

export function EodTrackerView({
  rows,
  tradingAccounts,
  initialJournalMonth,
  serverToday,
  openAiConfigured,
  summarizeUnrestricted,
}: {
  rows: EodTrackerRow[];
  tradingAccounts: EodTradingAccount[];
  /** From the server so the month picker matches SSR HTML on first paint. */
  initialJournalMonth: string;
  serverToday: string;
  openAiConfigured: boolean;
  summarizeUnrestricted: boolean;
}) {
  const [selectedMonth, setSelectedMonth] = useState(initialJournalMonth);
  const [sortRules, setSortRules] = useState<SortRule[]>([{ column: "date", dir: "desc" }]);
  const [showAllInTable, setShowAllInTable] = useState(false);
  const [showAiReview, setShowAiReview] = useState(false);

  const handleSort = useCallback((column: EodSortColumn, additive: boolean) => {
    setSortRules((prev) => {
      const idx = prev.findIndex((r) => r.column === column);
      if (!additive) {
        if (idx === 0) {
          const toggled = prev[0]?.dir === "asc" ? "desc" : "asc";
          return capSortRules([{ column, dir: toggled }]);
        }
        return capSortRules([{ column, dir: defaultDirFor(column) }]);
      }
      if (idx >= 0) {
        const next = [...prev];
        const current = next[idx]!;
        const toggled: SortRule = {
          column,
          dir: current.dir === "asc" ? "desc" : "asc",
        };
        next.splice(idx, 1);
        return capSortRules([toggled, ...next]);
      }
      return capSortRules([{ column, dir: defaultDirFor(column) }, ...prev]);
    });
  }, []);

  const monthRows = useMemo(
    () => rows.filter((r) => rowYearMonth(r) === selectedMonth),
    [rows, selectedMonth],
  );

  const tableSourceRows = showAllInTable ? rows : monthRows;

  const displayRows = useMemo(() => {
    const copy = [...tableSourceRows];
    copy.sort((a, b) => {
      for (const rule of sortRules) {
        const delta = compareRows(a, b, rule.column, rule.dir);
        if (delta !== 0) return delta;
      }
      return a.id.localeCompare(b.id);
    });
    return copy;
  }, [tableSourceRows, sortRules]);

  const chartRows = useMemo(
    () =>
      monthRows.map((r) => ({
        tradeDate: r.tradeDate,
        session: r.session,
        result: r.result,
        trend: r.trend,
        position: r.position,
        rrr: r.rrr,
        timeRange: r.timeRange,
        netPnlCents: r.netPnlCents,
      })),
    [monthRows],
  );

  const journalDataStamp = useMemo(
    () => eodMonthJournalDataStamp(rows, selectedMonth),
    [rows, selectedMonth],
  );

  return (
    <div className="space-y-4 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Trading dashboard
          </h1>
          <p className="mt-1 max-w-2xl text-xs italic leading-relaxed text-zinc-600 sm:text-sm dark:text-zinc-400">
            End-of-day journal, broker-level performance, and a P&amp;L calendar tied to the same
            rows—log structure and dollars in one place.
          </p>
        </div>
        <div className="flex w-full shrink-0 justify-stretch sm:w-auto sm:justify-end">
          <AddEodLauncher tradingAccounts={tradingAccounts} />
        </div>
      </div>

      <section
        id={EOD_SECTION_IDS.accounts}
        aria-label="Trading accounts"
        className="scroll-mt-14 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-500">
            Accounts
          </p>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Broker performance
          </h2>
        </div>
        <TradingAccountsSection rows={rows} tradingAccounts={tradingAccounts} />
      </section>

      <section
        id={EOD_SECTION_IDS.pnlCalendar}
        aria-label="Profit and loss calendar"
        className="scroll-mt-14 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-500">
            PnL calendar
          </p>
          <a
            href="https://www.forexfactory.com/calendar"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Economic calendar
          </a>
        </div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Monthly net P&amp;L
        </h2>
        <PnlCalendar
          rows={rows}
          tradingAccounts={tradingAccounts}
          initialMonth={initialJournalMonth}
          serverToday={serverToday}
        />
      </section>

      <section
        id={EOD_SECTION_IDS.analytics}
        aria-label="Journal analytics"
        className="scroll-mt-14 space-y-0"
      >
        <EodAnalyticsCharts rows={chartRows} />
      </section>

      <section
        id={EOD_SECTION_IDS.aiReview}
        aria-label="AI month review"
        className="scroll-mt-14 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-500">
              AI summary
            </p>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              AI month review
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowAiReview((prev) => !prev)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-expanded={showAiReview}
            aria-controls="eod-ai-review-content"
          >
            {showAiReview ? "Hide" : "Show"}
          </button>
        </div>
        {showAiReview ? (
          <div id="eod-ai-review-content">
            <EodAiAnalyticsPanel
              month={selectedMonth}
              journalDataStamp={journalDataStamp}
              openAiConfigured={openAiConfigured}
              summarizeUnrestricted={summarizeUnrestricted}
              journalEntryCountForMonth={monthRows.length}
            />
          </div>
        ) : (
          <p
            id="eod-ai-review-content"
            className="text-xs text-zinc-600 dark:text-zinc-400"
          >
            AI month review is hidden.
          </p>
        )}
      </section>

      <section
        id={EOD_SECTION_IDS.journalTable}
        aria-label="EOD journal table"
        className="scroll-mt-14 space-y-4"
      >
        {rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            No EOD rows yet. Use{" "}
            <strong className="text-zinc-900 dark:text-zinc-200">Add new EOD</strong> above to create
            your first one.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <fieldset className="m-0 flex w-full min-w-0 max-w-[14rem] flex-col gap-2 border-0 p-0">
                <legend className="sr-only">Journal month and table scope</legend>
                <label className="flex w-full flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Journal month
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="box-border h-10 min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-0 text-sm leading-10 text-zinc-900 touch-manipulation dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </label>
                <label className="flex items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={showAllInTable}
                    onChange={(e) => setShowAllInTable(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-amber-600 accent-amber-500 dark:border-zinc-700"
                  />
                  Show all entries in table
                </label>
              </fieldset>
              <p className="text-[11px] text-zinc-600 sm:max-w-md sm:text-right dark:text-zinc-500">
                {showAllInTable ? (
                  <>
                    Showing <span className="text-zinc-800 dark:text-zinc-400">all months</span>.
                    Analytics and AI summary use{" "}
                    <span className="text-zinc-800 dark:text-zinc-400">{monthLabel(selectedMonth)}</span>.
                  </>
                ) : (
                  <>
                    Showing entries in{" "}
                    <span className="text-zinc-800 dark:text-zinc-400">{monthLabel(selectedMonth)}</span>
                    . Analytics and AI summary use this month.
                  </>
                )}
              </p>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-500">
              Sort tip: Click a column to sort by it, or hold <kbd className="rounded border border-zinc-300 px-1 py-0.5 text-[10px] font-semibold dark:border-zinc-700">Shift</kbd> and click one other header for a secondary sort (max two columns). Adding a third replaces the previous secondary.
            </p>

            {!showAllInTable && monthRows.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                No journal entries in {monthLabel(selectedMonth)}. Choose another month or add an EOD
                for this period.
              </div>
            ) : (
              <>
                <ul className="flex list-none flex-col gap-3 md:hidden">
                  {displayRows.map((row) => (
                    <EodMobileRowCard key={row.id} row={row} tradingAccounts={tradingAccounts} />
                  ))}
                </ul>
                <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:block">
                  <table className="w-full min-w-[80rem] table-fixed border-collapse text-center text-xs">
                    <colgroup>
                      <col className="w-[7%]" />
                      <col className="w-[7%]" />
                      <col className="w-[7%]" />
                      <col className="w-[7%]" />
                      <col className="w-[7%]" />
                      <col className="w-[6%]" />
                      <col className="w-[5%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[5%]" />
                      <col className="w-[4%]" />
                      <col className="w-[10%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[5%]" />
                    </colgroup>
                    <thead className="bg-zinc-100/95 text-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-400">
                      <tr className="[&>th]:border-b [&>th]:border-zinc-200 [&>th]:px-2.5 [&>th]:py-2.5 [&>th]:text-center [&>th]:align-bottom [&>th]:font-medium [&>th]:leading-snug [&>th]:whitespace-normal dark:[&>th]:border-zinc-800 sm:[&>th]:px-3 md:[&>th]:px-3.5">
                        {SORTABLE.map(({ column, label }) => (
                          <SortableTh
                            key={column}
                            column={column}
                            label={label}
                            sortRules={sortRules}
                            onSort={handleSort}
                          />
                        ))}
                        <th className="min-w-[5.5rem]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-800 dark:text-zinc-200">
                      {displayRows.map((row) => {
                        const dt = new Date(row.tradeDate);
                        const weekday = dt.toLocaleDateString(EOD_DISPLAY_LOCALE, {
                          weekday: "long",
                        });
                        const dateLabel = dt.toLocaleDateString(EOD_DISPLAY_LOCALE, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                        return (
                          <tr
                            key={row.id}
                            className="align-top [&>td]:border-b [&>td]:border-zinc-200/90 [&>td]:px-2.5 [&>td]:py-2.5 [&>td]:text-center dark:[&>td]:border-zinc-800/60 sm:[&>td]:px-3 md:[&>td]:px-3.5"
                          >
                            <td className="whitespace-nowrap">
                              <PillOne value={weekday} fieldKey="weekday" />
                            </td>
                            <td className="min-w-0 text-center text-zinc-700 dark:text-zinc-300">
                              {row.tradingAccountName ?? (
                                <span className="text-zinc-400 dark:text-zinc-500">—</span>
                              )}
                            </td>
                            <td>
                              <PillList items={splitMultiValue(row.session)} fieldKey="session" />
                            </td>
                            <td>
                              <PillList items={row.timeframeEof} fieldKey="timeframeEof" />
                            </td>
                            <td>
                              <PillList items={row.poi} fieldKey="poi" />
                            </td>
                            <td>
                              <PillList items={splitMultiValue(row.trend)} fieldKey="trend" />
                            </td>
                            <td>
                              <PillList items={splitMultiValue(row.position)} fieldKey="position" />
                            </td>
                            <td>
                              <PillList items={splitMultiValue(row.riskType)} fieldKey="riskType" />
                            </td>
                            <td>
                              <PillList items={row.result} fieldKey="result" />
                            </td>
                            <td className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                              {row.netPnlCents === null ? (
                                <span className="text-zinc-400 dark:text-zinc-500">—</span>
                              ) : (
                                formatUsdFromCents(row.netPnlCents)
                              )}
                            </td>
                            <td>
                              <PillList items={splitMultiValue(row.rrr)} fieldKey="rrr" />
                            </td>
                            <td className="min-w-0 whitespace-pre-wrap break-words text-center text-zinc-700 dark:text-zinc-300">
                              {row.timeRange || "—"}
                            </td>
                            <td>
                              <PillList items={splitMultiValue(row.entryTf)} fieldKey="entryTf" />
                            </td>
                            <td className="min-w-0 break-words text-center text-zinc-700 dark:text-zinc-300">
                              {row.remarks || "-"}
                            </td>
                            <td className="min-w-0 text-center">
                              {row.notionUrl.trim() ? (
                                <a
                                  href={row.notionUrl.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block max-w-full break-all text-[11px] font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
                                >
                                  Open
                                </a>
                              ) : (
                                <span className="text-zinc-400 dark:text-zinc-500">—</span>
                              )}
                            </td>
                            <td className="min-w-0 break-words text-center text-zinc-600 leading-tight dark:text-zinc-400">
                              {dateLabel}
                            </td>
                            <td className="text-center">
                              <div className="flex flex-wrap justify-center">
                                <EodRowManageActions
                                  rowId={row.id}
                                  tradingAccounts={tradingAccounts}
                                  initial={{
                                    tradeDate: row.tradeDate.slice(0, 10),
                                    session: row.session,
                                    timeframeEof: row.timeframeEof,
                                    poi: row.poi,
                                    trend: row.trend,
                                    position: row.position,
                                    riskType: row.riskType,
                                    result: row.result,
                                    rrr: row.rrr,
                                    timeRange: row.timeRange,
                                    entryTf: row.entryTf,
                                    remarks: row.remarks,
                                    notionUrl: row.notionUrl,
                                    tradingAccountId: row.tradingAccountId,
                                    netPnlCents: row.netPnlCents,
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </section>

    </div>
  );
}
