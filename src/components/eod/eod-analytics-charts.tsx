"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import {
  buildEodChartsModel,
  type EodChartRange,
  type EodChartRowInput,
} from "@/lib/eod-chart-data";

const RANGE_OPTIONS: { id: EodChartRange; label: string }[] = [
  { id: "3m", label: "3 months" },
  { id: "6m", label: "6 months" },
  { id: "12m", label: "12 months" },
  { id: "all", label: "All time" },
];

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-zinc-200 bg-white/90 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90 ${className}`}
    >
      <div className="border-b border-zinc-200/90 px-3 py-2.5 dark:border-zinc-800/80 sm:px-4">
        <h3 className="text-xs font-semibold text-zinc-900 sm:text-sm dark:text-zinc-100">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-[10px] text-zinc-600 sm:text-xs dark:text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      <div className="min-h-0 p-2 sm:p-3">{children}</div>
    </div>
  );
}

export function EodAnalyticsCharts({ rows }: { rows: EodChartRowInput[] }) {
  const [range, setRange] = useState<EodChartRange>("6m");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const narrow = useIsNarrow(640);

  const model = useMemo(() => buildEodChartsModel(rows, range), [rows, range]);

  const gridStroke = isDark ? "#3f3f46" : "#d4d4d8";
  const axisColor = isDark ? "#a1a1aa" : "#52525b";
  const barFill = isDark ? "#f59e0b" : "#d97706";
  const barFill2 = isDark ? "#22d3ee" : "#0891b2";

  const tooltipBox = isDark
    ? "rounded-lg border border-zinc-600 bg-zinc-900/95 px-2.5 py-2 text-[11px] shadow-lg backdrop-blur-sm"
    : "rounded-lg border border-zinc-300 bg-white/95 px-2.5 py-2 text-[11px] text-zinc-900 shadow-lg backdrop-blur-sm";
  const tooltipTitle = isDark ? "font-medium text-zinc-200" : "font-medium text-zinc-900";
  const tooltipMuted = isDark ? "tabular-nums text-zinc-400" : "tabular-nums text-zinc-600";

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
          Journal analytics
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-zinc-600 dark:text-zinc-500">
          Add EOD entries to unlock charts: activity over time, result mix, sessions, weekdays, and
          trend tags.
        </p>
      </section>
    );
  }

  const emptyRange = model.kpi.entries === 0;

  return (
    <section
      className="space-y-3 rounded-xl border border-zinc-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90 sm:p-5"
      aria-labelledby="eod-charts-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="eod-charts-heading"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Journal analytics
          </h2>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-500">
            Visual breakdown of your logged sessions (filtered range applies to all charts).
          </p>
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Chart time range"
        >
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRange(opt.id)}
              className={`min-h-9 touch-manipulation rounded-lg px-3 py-1.5 text-xs font-medium transition sm:min-h-8 ${
                range === opt.id
                  ? "bg-amber-500/90 text-zinc-950"
                  : "border border-zinc-300 bg-zinc-100 text-zinc-800 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {emptyRange ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200/90">
          No entries in this range. Try <strong className="font-semibold">All time</strong> or a
          wider window.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
            Entries
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {model.kpi.entries}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
            Win rows
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {model.kpi.winRows}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
            Loss rows
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">
            {model.kpi.lossRows}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
            Active days
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {model.kpi.uniqueDays}
          </p>
        </div>
      </div>

      <ChartCard
        title="Activity by month"
        subtitle="Number of journal rows logged per month"
        className="min-w-0"
      >
        <div className="h-52 w-full min-w-0 sm:h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={model.monthlyActivity}
              margin={
                narrow
                  ? { top: 6, right: 4, left: -18, bottom: 4 }
                  : { top: 8, right: 8, left: -8, bottom: 4 }
              }
            >
              <CartesianGrid strokeDasharray="4 6" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: axisColor, fontSize: narrow ? 9 : 10 }}
                tickLine={false}
                axisLine={{ stroke: gridStroke }}
                interval={narrow ? "preserveStartEnd" : 0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: axisColor, fontSize: narrow ? 9 : 10 }}
                tickLine={false}
                axisLine={false}
                width={narrow ? 28 : 32}
              />
              <Tooltip
                cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className={tooltipBox}>
                      <p className={`mb-1 ${tooltipTitle}`}>{label}</p>
                      <p className={tooltipMuted}>
                        {payload[0]?.value} {Number(payload[0]?.value) === 1 ? "entry" : "entries"}
                      </p>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="count" name="Entries" fill={barFill} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <ChartCard title="Result tags" subtitle="How often each result appears (rows can have several)">
          <div className="h-56 w-full min-w-0 sm:h-64">
            {model.resultMix.length === 0 ? (
              <p className="py-12 text-center text-xs text-zinc-600 dark:text-zinc-500">
                No result tags in this range.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={model.resultMix}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={narrow ? 44 : 52}
                    outerRadius={narrow ? 72 : 88}
                    paddingAngle={1}
                    label={
                      narrow
                        ? false
                        : ({ name, percent }) => {
                            const pct = Math.round((percent ?? 0) * 100);
                            return `${name ?? ""} ${pct}%`;
                          }
                    }
                    labelLine={narrow ? false : { stroke: axisColor }}
                  >
                    {model.resultMix.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className={tooltipBox}>
                          <p className={tooltipTitle}>{String(payload[0].name)}</p>
                          <p className={tooltipMuted}>{String(payload[0].value)} tags</p>
                        </div>
                      ) : null
                    }
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: 8 }}
                    formatter={(value) => (
                      <span className="text-[10px] text-zinc-600 sm:text-xs dark:text-zinc-400">
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Long vs short" subtitle="Rows with a position set">
          <div className="h-56 w-full min-w-0 sm:h-64">
            {model.positionSplit.length === 0 ? (
              <p className="py-12 text-center text-xs text-zinc-600 dark:text-zinc-500">
                No position tags in this range.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={model.positionSplit}
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="4 6" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: axisColor, fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={narrow ? 52 : 56}
                    tick={{ fill: axisColor, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className={tooltipBox}>
                          <p className={tooltipTitle}>{String(payload[0].payload.name)}</p>
                          <p className={tooltipMuted}>{String(payload[0].value)} rows</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="value" fill={barFill2} radius={[0, 4, 4, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <ChartCard title="Sessions" subtitle="Top sessions by row count">
          <div className="h-56 w-full min-w-0 sm:h-64">
            {model.sessionBars.length === 0 ? (
              <p className="py-12 text-center text-xs text-zinc-600 dark:text-zinc-500">
                No session tags in this range.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={model.sessionBars}
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="4 6" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: axisColor, fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={narrow ? 72 : 88}
                    tick={{ fill: axisColor, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className={tooltipBox}>
                          <p className={`mb-0.5 max-w-[12rem] leading-snug ${tooltipTitle}`}>
                            {String(payload[0].payload.name)}
                          </p>
                          <p className={tooltipMuted}>{String(payload[0].value)} rows</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="count" fill={barFill} radius={[0, 4, 4, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Weekday" subtitle="Entries by weekday (UTC date on row)">
          <div className="h-56 w-full min-w-0 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={model.weekdayBars}
                margin={
                  narrow
                    ? { top: 6, right: 4, left: -18, bottom: 4 }
                    : { top: 8, right: 8, left: -8, bottom: 4 }
                }
              >
                <CartesianGrid strokeDasharray="4 6" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="short"
                  tick={{ fill: axisColor, fontSize: narrow ? 9 : 10 }}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: axisColor, fontSize: narrow ? 9 : 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={narrow ? 28 : 32}
                />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className={tooltipBox}>
                        <p className={tooltipTitle}>
                          {model.weekdayBars.find((w) => w.short === label)?.name ?? label}
                        </p>
                        <p className={tooltipMuted}>
                          {payload[0]?.value} {Number(payload[0]?.value) === 1 ? "entry" : "entries"}
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Trend context" subtitle="Top trend tags">
        <div className="h-52 w-full min-w-0 sm:h-56">
          {model.trendBars.length === 0 ? (
            <p className="py-10 text-center text-xs text-zinc-600 dark:text-zinc-500">
              No trend tags in this range.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={model.trendBars}
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="4 6" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: axisColor, fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={narrow ? 72 : 96}
                  tick={{ fill: axisColor, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className={tooltipBox}>
                        <p className={tooltipTitle}>{String(payload[0].payload.name)}</p>
                        <p className={tooltipMuted}>{String(payload[0].value)} rows</p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="count" fill="#c084fc" radius={[0, 4, 4, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>
    </section>
  );
}
