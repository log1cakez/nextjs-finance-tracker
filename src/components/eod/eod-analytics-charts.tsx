"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import { type EodChartRowInput } from "@/lib/eod-chart-data";
import { formatUsdFromCents } from "@/lib/eod-money";

const WEEKDAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const SESSION_ORDER = ["London", "New York", "Asia", "Out Of Session"] as const;
const RR_RE = /-?\d+(\.\d+)?/;
const MULTI_VALUE_DELIMITER = "|";

function toWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

function parseRr(value: string): number | null {
  const matched = value.match(RR_RE)?.[0];
  if (!matched) return null;
  const num = Number(matched);
  return Number.isFinite(num) ? num : null;
}

function ratioPercent(a: number, b: number): number {
  if (b <= 0) return 0;
  return (a / b) * 100;
}

function numberText(value: number, digits = 2): string {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function splitMultiValue(raw: string): string[] {
  return raw
    .split(MULTI_VALUE_DELIMITER)
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeSessionToken(token: string): string {
  const t = token.trim().toLowerCase();
  if (!t) return "";
  if (t === "london" || t === "ldn") return "London";
  if (t === "new york" || t === "newyork" || t === "ny") return "New York";
  if (t === "asia" || t === "tokyo" || t === "sydney") return "Asia";
  if (t === "out of session" || t === "oos") return "Out Of Session";
  return token.trim();
}

function parseMinutesFromTimeRange(timeRange: string): number | null {
  const m = timeRange.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const sh = Number(m[1]);
  const sm = Number(m[2]);
  const eh = Number(m[3]);
  const em = Number(m[4]);
  if ([sh, sm, eh, em].some((v) => Number.isNaN(v))) return null;
  let start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end < start) end += 24 * 60;
  return Math.max(0, end - start);
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  const d = Math.floor(minutes / (24 * 60));
  const h = Math.floor((minutes % (24 * 60)) / 60);
  const m = Math.floor(minutes % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
}

function TinyMetric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-zinc-500 dark:text-zinc-500">{label}</p>
      <p className="mt-0.5 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {value}
        {suffix ? <span className="ml-1 text-base font-medium">{suffix}</span> : null}
      </p>
    </div>
  );
}

function InfoCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{title}</h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-zinc-500 dark:text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-800 dark:text-zinc-200">{value}</span>
    </div>
  );
}

export function EodAnalyticsCharts({ rows }: { rows: EodChartRowInput[] }) {
  const [dayFilter, setDayFilter] = useState<string>("all");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const narrow = useIsNarrow(640);

  const dayFilters = useMemo(() => {
    const present = new Set(rows.map((r) => toWeekday(r.tradeDate)));
    return [
      { id: "all", label: "All" },
      ...WEEKDAY_ORDER.filter((day) => present.has(day)).map((day) => ({ id: day, label: day })),
    ];
  }, [rows]);

  const filteredRows = useMemo(
    () => rows.filter((r) => (dayFilter === "all" ? true : toWeekday(r.tradeDate) === dayFilter)),
    [rows, dayFilter],
  );

  const totalTrades = filteredRows.length;
  const totalPnlCents = filteredRows.reduce((sum, r) => sum + (r.netPnlCents ?? 0), 0);
  const winTrades = filteredRows.filter((r) => r.result.includes("Win")).length;
  const losingTrades = filteredRows.filter((r) => r.result.includes("Loss")).length;
  const breakEvenTrades = filteredRows.filter((r) => r.result.includes("Break Even")).length;
  const winRate = ratioPercent(winTrades, totalTrades);

  const rrValues = filteredRows.map((r) => parseRr(r.rrr)).filter((v): v is number => v !== null);
  const avgRr = rrValues.length ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0;
  const maxRr = rrValues.length ? Math.max(...rrValues) : 0;
  const winRrs = filteredRows
    .filter((r) => r.result.includes("Win"))
    .map((r) => parseRr(r.rrr))
    .filter((v): v is number => v !== null);
  const lossRrs = filteredRows
    .filter((r) => r.result.includes("Loss"))
    .map((r) => parseRr(r.rrr))
    .filter((v): v is number => v !== null);
  const bestWinRr = winRrs.length ? Math.max(...winRrs) : 0;
  const avgWinRr = winRrs.length ? winRrs.reduce((a, b) => a + b, 0) / winRrs.length : 0;
  const worstLossRr = lossRrs.length ? Math.min(...lossRrs) : 0;
  const avgLossRr = lossRrs.length ? lossRrs.reduce((a, b) => a + b, 0) / lossRrs.length : 0;

  const durationMinutes = filteredRows
    .map((r) => parseMinutesFromTimeRange(r.timeRange))
    .filter((v): v is number => v !== null);
  const avgDuration = durationMinutes.length
    ? durationMinutes.reduce((a, b) => a + b, 0) / durationMinutes.length
    : 0;
  const winDurationRows = filteredRows
    .filter((r) => r.result.includes("Win"))
    .map((r) => parseMinutesFromTimeRange(r.timeRange))
    .filter((v): v is number => v !== null);
  const loseDurationRows = filteredRows
    .filter((r) => r.result.includes("Loss"))
    .map((r) => parseMinutesFromTimeRange(r.timeRange))
    .filter((v): v is number => v !== null);
  const avgWinDuration = winDurationRows.length
    ? winDurationRows.reduce((a, b) => a + b, 0) / winDurationRows.length
    : 0;
  const avgLossDuration = loseDurationRows.length
    ? loseDurationRows.reduce((a, b) => a + b, 0) / loseDurationRows.length
    : 0;
  const tradeTimes = filteredRows.map((r) => new Date(r.tradeDate).getTime()).filter(Number.isFinite);
  const accountAgeMinutes =
    tradeTimes.length >= 2 ? (Math.max(...tradeTimes) - Math.min(...tradeTimes)) / 60000 : 0;

  const dailyPerformance = useMemo(() => {
    const map = new Map<string, { day: string; profit: number; loss: number }>();
    for (const row of filteredRows) {
      const day = toWeekday(row.tradeDate);
      const existing = map.get(day) ?? { day, profit: 0, loss: 0 };
      const v = row.netPnlCents ?? 0;
      if (v >= 0) existing.profit += v / 100;
      else existing.loss += v / 100;
      map.set(day, existing);
    }
    return WEEKDAY_ORDER.map((day) => map.get(day) ?? { day, profit: 0, loss: 0 });
  }, [filteredRows]);

  const sessions = useMemo(() => {
    const map = new Map<
      string,
      { totalTrades: number; wins: number; maxRr: number; profitCents: number }
    >();
    for (const row of filteredRows) {
      const tokens = splitMultiValue(row.session).map(normalizeSessionToken).filter(Boolean);
      const rowSessions = new Set(tokens.length ? tokens : ["Out Of Session"]);
      for (const session of rowSessions) {
        const existing = map.get(session) ?? {
          totalTrades: 0,
          wins: 0,
          maxRr: 0,
          profitCents: 0,
        };
        existing.totalTrades += 1;
        if (row.result.includes("Win")) existing.wins += 1;
        const rr = parseRr(row.rrr);
        if (rr !== null) existing.maxRr = Math.max(existing.maxRr, rr);
        existing.profitCents += row.netPnlCents ?? 0;
        map.set(session, existing);
      }
    }

    const ordered = [
      ...SESSION_ORDER.filter((name) => map.has(name)),
      ...[...map.keys()]
        .filter((name) => !SESSION_ORDER.includes(name as (typeof SESSION_ORDER)[number]))
        .sort((a, b) => a.localeCompare(b)),
    ];

    return ordered.map((session) => {
      const data = map.get(session)!;
      return {
        session,
        winRate: ratioPercent(data.wins, data.totalTrades),
        totalTrades: data.totalTrades,
        maxRr: data.maxRr,
        profitUsd: data.profitCents / 100,
      };
    });
  }, [filteredRows]);

  if (rows.length === 0) {
    return (
      <section
        className="rounded-xl border border-zinc-200 bg-white/90 px-4 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950/90"
        aria-labelledby="eod-charts-empty-heading"
      >
        <h2
          id="eod-charts-empty-heading"
          className="text-sm font-semibold text-zinc-900 dark:text-zinc-200"
        >
          Analytics dashboard
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-zinc-600 dark:text-zinc-500">
          Add EOD entries to unlock the analytics dashboard.
        </p>
      </section>
    );
  }

  return (
    <section
      className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-5"
      aria-labelledby="eod-charts-heading"
    >
      <div>
        <h2 id="eod-charts-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Analytics dashboard
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">Check your performance for this session.</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Day Filters</p>
        <div className="flex flex-wrap gap-2">
          {dayFilters.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => setDayFilter(day.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                dayFilter === day.id
                  ? "bg-rose-500 text-white"
                  : "border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-2xl bg-slate-900 p-4 text-white shadow-md">
        <div>
          <h3 className="text-lg font-semibold">Profit and Losses</h3>
          <p className="text-xs text-slate-300">over time</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-white sm:grid-cols-4">
          <div>
            <p className="text-[11px] text-slate-300">Total PnL</p>
            <p className="text-3xl font-semibold tracking-tight">{formatUsdFromCents(totalPnlCents)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-300">Account Balance</p>
            <p className="text-3xl font-semibold tracking-tight">{formatUsdFromCents(totalPnlCents)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-300">Win rate</p>
            <p className="text-3xl font-semibold tracking-tight">{numberText(winRate, 0)}%</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-300">Total Trades</p>
            <p className="text-3xl font-semibold tracking-tight">{totalTrades}</p>
          </div>
        </div>
        <div className="mt-4 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dailyPerformance}
              margin={
                narrow
                  ? { top: 6, right: 2, left: -24, bottom: 0 }
                  : { top: 8, right: 12, left: -8, bottom: 0 }
              }
            >
              <CartesianGrid strokeDasharray="4 5" stroke="#334155" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15,23,42,.95)",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
              />
              <Bar dataKey="profit" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="loss" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoCard title="Average RR">
          <div className="grid grid-cols-2 gap-3">
            <TinyMetric label="Average RR" value={numberText(avgRr)} />
            <TinyMetric label="Max RR" value={numberText(maxRr)} />
          </div>
        </InfoCard>
        <InfoCard title="Ideal Average RR">
          <div className="grid grid-cols-2 gap-3">
            <TinyMetric label="Ideal Average RR" value={numberText(maxRr)} />
            <TinyMetric label="Max Ideal RR" value={numberText(maxRr)} />
          </div>
        </InfoCard>
        <InfoCard title="Could have profit/BE">
          <div className="grid grid-cols-2 gap-3">
            <TinyMetric label="Could have profit/BE" value={numberText(breakEvenTrades, 0)} />
            <TinyMetric label="Max Ideal RR" value={numberText(maxRr)} />
          </div>
        </InfoCard>
      </div>

      <div className="inline-flex rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        Advanced Analytics
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <InfoCard title="Summary">
          <div className="space-y-2">
            <StatLine label="Average RR" value={numberText(avgRr)} />
            <StatLine label="Average Duration" value={formatDuration(avgDuration)} />
            <StatLine label="Total Trades" value={String(totalTrades)} />
            <StatLine label="Account Age" value={formatDuration(accountAgeMinutes)} />
          </div>
        </InfoCard>
        <InfoCard title="Winning Trades">
          <div className="space-y-2">
            <StatLine label="Total Winners" value={String(winTrades)} />
            <StatLine label="Best Win RR" value={numberText(bestWinRr)} />
            <StatLine label="Average Win RR" value={numberText(avgWinRr)} />
            <StatLine label="Average Duration" value={formatDuration(avgWinDuration)} />
          </div>
        </InfoCard>
        <InfoCard title="Losing Trades">
          <div className="space-y-2">
            <StatLine label="Total Losers" value={String(losingTrades)} />
            <StatLine label="Worst Loss RR" value={numberText(worstLossRr)} />
            <StatLine label="Average Loss RR" value={numberText(avgLossRr)} />
            <StatLine label="Average Duration" value={formatDuration(avgLossDuration)} />
          </div>
        </InfoCard>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Performance per day</h4>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dailyPerformance}
              layout="vertical"
              margin={{ top: 4, right: 14, left: 8, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="4 5"
                stroke={isDark ? "#27272a" : "#e4e4e7"}
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: isDark ? "#a1a1aa" : "#52525b", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="day"
                width={76}
                tick={{ fill: isDark ? "#a1a1aa" : "#52525b", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "rgba(24,24,27,.95)" : "rgba(255,255,255,.97)",
                  border: `1px solid ${isDark ? "#3f3f46" : "#d4d4d8"}`,
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                formatter={(value, name) => {
                  const numericValue = Number(value ?? 0);
                  const absCents = Math.round(Math.abs(numericValue) * 100);
                  const label = String(name).toLowerCase().includes("profit")
                    ? "Daily Profits"
                    : "Daily Losses";
                  return [formatUsdFromCents(absCents), label];
                }}
                labelFormatter={(label) => String(label)}
              />
              <Bar dataKey="profit" name="Daily Profits" fill="#43bf63" stackId="day" radius={[0, 4, 4, 0]} />
              <Bar dataKey="loss" name="Daily Losses" fill="#c74646" stackId="day" radius={[4, 0, 0, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Trades By Sessions</h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Here you can see your performance by sessions.
        </p>
        <div className="grid gap-3 lg:grid-cols-4">
          {sessions.map((s) => (
            <InfoCard key={s.session} title={s.session}>
              <div className="space-y-2">
                <StatLine label="Win Rate" value={`${numberText(s.winRate)}%`} />
                <StatLine label="Total Trades" value={String(s.totalTrades)} />
                <StatLine label="Max RR" value={numberText(s.maxRr)} />
                <StatLine label="Profit" value={`$${numberText(s.profitUsd)}`} />
              </div>
            </InfoCard>
          ))}
        </div>
      </section>

      {filteredRows.length === 0 ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200/90">
          No entries for the selected day filter.
        </p>
      ) : null}
    </section>
  );
}
