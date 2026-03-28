"use client";

import { useId, useMemo } from "react";
import { useTheme } from "next-themes";
import { useIsNarrow } from "@/hooks/use-is-narrow";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyCashflowPoint } from "@/app/actions/transactions";
import { formatMoney, type FiatCurrency } from "@/lib/money";

function compactMoney(minor: number, currency: FiatCurrency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(minor / 100);
  } catch {
    return formatMoney(minor, currency);
  }
}

export function DashboardCashflowChart({
  data,
  currency,
}: {
  data: MonthlyCashflowPoint[];
  currency: FiatCurrency;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const narrow = useIsNarrow(640);
  const gid = useId().replace(/:/g, "");

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        label: d.label,
        income: d.incomeMinor,
        expense: d.expenseMinor,
      })),
    [data],
  );

  const incomeStroke = isDark ? "#4ade80" : "#16a34a";
  const incomeFill = isDark ? "#4ade80" : "#22c55e";
  const expenseStroke = isDark ? "#fb7185" : "#e11d48";
  const expenseFill = isDark ? "#fb7185" : "#f43f5e";
  const gridStroke = isDark ? "#3f3f46" : "#e4e4e7";
  const axisColor = isDark ? "#a1a1aa" : "#71717a";

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/80 shadow-sm dark:border-zinc-800/80 dark:from-zinc-950 dark:to-zinc-950/50">
      <div className="border-b border-zinc-100 px-4 py-3 sm:px-5 sm:py-4 dark:border-zinc-800/80">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Cash flow trend
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Actual income and expenses by month ({currency})
        </p>
      </div>
      <div className="h-[min(17rem,50vw)] w-full min-w-0 px-1 pb-3 pt-1 sm:h-80 sm:px-4 sm:pb-4 sm:pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={
              narrow
                ? { top: 8, right: 4, left: 0, bottom: 6 }
                : { top: 12, right: 8, left: 0, bottom: 0 }
            }
          >
            <defs>
              <linearGradient
                id={`${gid}-income`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={incomeFill}
                  stopOpacity={isDark ? 0.45 : 0.35}
                />
                <stop
                  offset="100%"
                  stopColor={incomeFill}
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient
                id={`${gid}-expense`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={expenseFill}
                  stopOpacity={isDark ? 0.4 : 0.3}
                />
                <stop
                  offset="100%"
                  stopColor={expenseFill}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 8"
              stroke={gridStroke}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: axisColor, fontSize: narrow ? 9 : 11 }}
              tickLine={false}
              axisLine={{ stroke: gridStroke }}
              dy={6}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: axisColor, fontSize: narrow ? 9 : 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => compactMoney(Number(v), currency)}
              width={narrow ? 42 : 56}
            />
            <Tooltip
              cursor={{ stroke: gridStroke, strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const inc = payload.find((p) => p.dataKey === "income");
                const exp = payload.find((p) => p.dataKey === "expense");
                return (
                  <div className="rounded-xl border border-zinc-200 bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm dark:border-zinc-600 dark:bg-zinc-900/95">
                    <p className="mb-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                      {label}
                    </p>
                    {inc != null ? (
                      <p className="flex justify-between gap-6 tabular-nums">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Income
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {formatMoney(Number(inc.value), currency)}
                        </span>
                      </p>
                    ) : null}
                    {exp != null ? (
                      <p className="mt-1 flex justify-between gap-6 tabular-nums">
                        <span className="text-rose-600 dark:text-rose-400">
                          Expenses
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {formatMoney(Number(exp.value), currency)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 8 }}
              formatter={(value) => (
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {value}
                </span>
              )}
            />
            <Area
              type="monotone"
              name="Income"
              dataKey="income"
              stroke={incomeStroke}
              strokeWidth={2.5}
              fill={`url(#${gid}-income)`}
              fillOpacity={1}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              name="Expenses"
              dataKey="expense"
              stroke={expenseStroke}
              strokeWidth={2.5}
              fill={`url(#${gid}-expense)`}
              fillOpacity={1}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
