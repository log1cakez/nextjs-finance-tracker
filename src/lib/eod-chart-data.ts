import type { EodRowAnalytics } from "@/lib/eod-analytics-summary";

export type EodChartRowInput = Pick<
  EodRowAnalytics,
  "tradeDate" | "session" | "result" | "trend" | "position"
>;

export type EodChartRange = "3m" | "6m" | "12m" | "all";

const WEEKDAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function ymdFromTradeIso(iso: string): string {
  return iso.slice(0, 10);
}

function ymFromTradeIso(iso: string): string {
  return iso.slice(0, 7);
}

/** First day of month, `monthsBack` before the given anchor (local calendar). */
function monthStartLocal(anchor: Date, monthsBack: number): Date {
  const d = new Date(anchor.getFullYear(), anchor.getMonth() - monthsBack, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inclusive month keys from oldest to newest (local), length = `spanMonths`. */
function rollingMonthKeys(spanMonths: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = spanMonths - 1; i >= 0; i--) {
    const d = monthStartLocal(now, i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function filterRowsByRange(
  rows: EodChartRowInput[],
  range: EodChartRange,
): EodChartRowInput[] {
  if (range === "all") return rows;
  const span = range === "3m" ? 3 : range === "6m" ? 6 : 12;
  const start = monthStartLocal(new Date(), span - 1);
  const startStr = formatYmdLocal(start);
  return rows.filter((r) => ymdFromTradeIso(r.tradeDate) >= startStr);
}

function bump(m: Record<string, number>, k: string) {
  m[k] = (m[k] ?? 0) + 1;
}

const RESULT_COLORS: Record<string, string> = {
  Win: "#34d399",
  Loss: "#f87171",
  "Break Even": "#94a3b8",
  Data: "#a78bfa",
  EOD: "#71717a",
  "Front Run": "#60a5fa",
};

export type EodChartsModel = {
  monthlyActivity: { key: string; label: string; count: number }[];
  resultMix: { name: string; value: number; fill: string }[];
  sessionBars: { name: string; count: number }[];
  weekdayBars: { name: string; short: string; count: number }[];
  trendBars: { name: string; count: number }[];
  positionSplit: { name: string; value: number }[];
  kpi: {
    entries: number;
    winRows: number;
    lossRows: number;
    uniqueDays: number;
  };
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function labelForYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${MONTH_SHORT[m - 1] ?? m} ${String(y).slice(-2)}`;
}

export function buildEodChartsModel(
  rows: EodChartRowInput[],
  range: EodChartRange,
): EodChartsModel {
  const filtered = filterRowsByRange(rows, range);
  const spanMonths = range === "all" ? 0 : range === "3m" ? 3 : range === "6m" ? 6 : 12;

  const monthKeys =
    range === "all"
      ? (() => {
          const set = new Set<string>();
          for (const r of filtered) {
            set.add(ymFromTradeIso(r.tradeDate));
          }
          return [...set].sort();
        })()
      : rollingMonthKeys(spanMonths);

  const perMonth: Record<string, number> = {};
  for (const k of monthKeys) perMonth[k] = 0;
  for (const r of filtered) {
    const ym = ymFromTradeIso(r.tradeDate);
    if (ym in perMonth) {
      bump(perMonth, ym);
    }
  }
  const monthlyActivity = monthKeys.map((key) => ({
    key,
    label: labelForYm(key),
    count: perMonth[key] ?? 0,
  }));

  const resultFreq: Record<string, number> = {};
  for (const r of filtered) {
    for (const t of r.result) {
      const x = t.trim();
      if (x) bump(resultFreq, x);
    }
  }
  const resultMix = Object.entries(resultFreq)
    .map(([name, value]) => ({
      name,
      value,
      fill: RESULT_COLORS[name] ?? "#a1a1aa",
    }))
    .sort((a, b) => b.value - a.value);

  const sessionFreq: Record<string, number> = {};
  for (const r of filtered) {
    const s = r.session.trim();
    if (s) bump(sessionFreq, s);
  }
  const sessionBars = Object.entries(sessionFreq)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const weekdayFreq: Record<string, number> = {};
  for (const w of WEEKDAY_ORDER) weekdayFreq[w] = 0;
  for (const r of filtered) {
    const d = new Date(r.tradeDate);
    const w = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    if (w in weekdayFreq) bump(weekdayFreq, w);
  }
  const shortDay: Record<string, string> = {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun",
  };
  const weekdayBars = WEEKDAY_ORDER.map((name) => ({
    name,
    short: shortDay[name],
    count: weekdayFreq[name] ?? 0,
  }));

  const trendFreq: Record<string, number> = {};
  for (const r of filtered) {
    const t = r.trend.trim();
    if (t) bump(trendFreq, t);
  }
  const trendBars = Object.entries(trendFreq)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const posFreq: Record<string, number> = {};
  for (const r of filtered) {
    const p = r.position.trim();
    if (p) bump(posFreq, p);
  }
  const positionSplit = Object.entries(posFreq).map(([name, value]) => ({ name, value }));

  const days = new Set(filtered.map((r) => ymdFromTradeIso(r.tradeDate)));
  const winRows = filtered.filter((r) => r.result.includes("Win")).length;
  const lossRows = filtered.filter((r) => r.result.includes("Loss")).length;

  return {
    monthlyActivity,
    resultMix,
    sessionBars,
    weekdayBars,
    trendBars,
    positionSplit,
    kpi: {
      entries: filtered.length,
      winRows,
      lossRows,
      uniqueDays: days.size,
    },
  };
}
