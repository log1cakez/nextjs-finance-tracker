import type { EodTrackerRow } from "@/app/actions/eod-tracker-rows";
import type { EodTradingAccount } from "@/app/actions/eod-trading-accounts";

export type TradingAccountSummary = {
  id: string;
  name: string;
  initialCapitalCents: number;
  totalTrades: number;
  wins: number;
  profitCents: number;
  balanceCents: number;
  roiPercent: number | null;
  winRatePercent: number | null;
};

function rowMatchesAccount(row: EodTrackerRow, accountId: string | "all"): boolean {
  if (accountId === "all") return true;
  return row.tradingAccountId === accountId;
}

function rowDateKey(row: EodTrackerRow): string {
  return row.tradeDate.slice(0, 10);
}

function isWin(row: EodTrackerRow): boolean {
  return row.result.some((x) => x === "Win");
}

/** Per-calendar-day stats for PnL calendar (month filter + optional account). */
export function dailyPnLForMonth(
  rows: EodTrackerRow[],
  yearMonth: string,
  accountId: string | "all",
): Map<string, { pnlCents: number; tradeCount: number; wins: number }> {
  const map = new Map<string, { pnlCents: number; tradeCount: number; wins: number }>();
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return map;

  for (const row of rows) {
    if (!rowMatchesAccount(row, accountId)) continue;
    const dk = rowDateKey(row);
    if (!dk.startsWith(yearMonth)) continue;
    const pnl = row.netPnlCents;
    const cur = map.get(dk) ?? { pnlCents: 0, tradeCount: 0, wins: 0 };
    cur.tradeCount += 1;
    if (isWin(row)) cur.wins += 1;
    if (pnl !== null) cur.pnlCents += pnl;
    map.set(dk, cur);
  }
  return map;
}

export function monthNetPnlCents(
  rows: EodTrackerRow[],
  yearMonth: string,
  accountId: string | "all",
): number {
  let sum = 0;
  for (const [, v] of dailyPnLForMonth(rows, yearMonth, accountId)) {
    sum += v.pnlCents;
  }
  return sum;
}

export function monthTradedDaysCount(
  rows: EodTrackerRow[],
  yearMonth: string,
  accountId: string | "all",
): number {
  const days = new Set<string>();
  for (const row of rows) {
    if (!rowMatchesAccount(row, accountId)) continue;
    if (!rowDateKey(row).startsWith(yearMonth)) continue;
    if (row.netPnlCents !== null) days.add(rowDateKey(row));
  }
  return days.size;
}

export function buildTradingAccountSummaries(
  rows: EodTrackerRow[],
  accounts: EodTradingAccount[],
): TradingAccountSummary[] {
  return accounts.map((acc) => {
    const mine = rows.filter((r) => r.tradingAccountId === acc.id);
    const totalTrades = mine.length;
    const wins = mine.filter((r) => isWin(r)).length;
    let profitCents = 0;
    for (const r of mine) {
      if (r.netPnlCents !== null) profitCents += r.netPnlCents;
    }
    const initial = acc.initialCapitalCents;
    const balanceCents = initial + profitCents;
    const roiPercent =
      initial > 0 ? (profitCents / initial) * 100 : profitCents !== 0 ? null : 0;
    const winRatePercent = totalTrades > 0 ? (wins / totalTrades) * 100 : null;
    return {
      id: acc.id,
      name: acc.name,
      initialCapitalCents: initial,
      totalTrades,
      wins,
      profitCents,
      balanceCents,
      roiPercent,
      winRatePercent,
    };
  });
}

export type CalendarWeekRow = {
  weekIndex: number;
  cells: { dateKey: string; inMonth: boolean; dayOfMonth: number }[];
  weekPnlCents: number;
  weekTradedDays: number;
};

function toDateKey(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Sunday-first weeks overlapping `yearMonth`; includes leading/trailing days outside month. */
export function calendarWeekGrid(yearMonth: string): CalendarWeekRow[] {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return [];
  const [ys, ms] = yearMonth.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return [];

  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startPad = first.getDay();

  const cells: { dateKey: string; inMonth: boolean; dayOfMonth: number }[] = [];

  for (let i = 0; i < startPad; i++) {
    const dt = new Date(y, m - 1, 1 - (startPad - i));
    cells.push({
      dateKey: toDateKey(dt),
      inMonth: false,
      dayOfMonth: dt.getDate(),
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(y, m - 1, d);
    cells.push({ dateKey: toDateKey(dt), inMonth: true, dayOfMonth: d });
  }
  let pad = 1;
  while (cells.length % 7 !== 0) {
    const dt = new Date(y, m - 1, daysInMonth + pad);
    cells.push({
      dateKey: toDateKey(dt),
      inMonth: false,
      dayOfMonth: dt.getDate(),
    });
    pad += 1;
  }

  const weeks: CalendarWeekRow[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const slice = cells.slice(i, i + 7);
    weeks.push({
      weekIndex: weeks.length + 1,
      cells: slice,
      weekPnlCents: 0,
      weekTradedDays: 0,
    });
  }
  return weeks;
}

export function attachWeekStats(
  weeks: CalendarWeekRow[],
  daily: Map<string, { pnlCents: number; tradeCount: number; wins: number }>,
  rows: EodTrackerRow[],
  yearMonth: string,
  accountId: string | "all",
): CalendarWeekRow[] {
  return weeks.map((w) => {
    let weekPnlCents = 0;
    const traded = new Set<string>();
    for (const c of w.cells) {
      const stats = daily.get(c.dateKey);
      if (stats) weekPnlCents += stats.pnlCents;
      const hasPnlRow = rows.some(
        (r) =>
          rowMatchesAccount(r, accountId) &&
          rowDateKey(r) === c.dateKey &&
          r.netPnlCents !== null,
      );
      if (hasPnlRow) traded.add(c.dateKey);
    }
    return { ...w, weekPnlCents, weekTradedDays: traded.size };
  });
}
