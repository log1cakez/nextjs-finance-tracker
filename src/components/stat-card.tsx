import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  variant,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  variant: "neutral" | "income" | "expense";
  children?: ReactNode;
}) {
  const styles = {
    neutral:
      "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/50",
    income:
      "border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/30",
    expense:
      "border-rose-200/80 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/30",
  }[variant];

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${styles}`}
    >
      <p className="text-xs font-medium text-zinc-500 sm:text-sm dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1.5 break-words text-xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:mt-2 sm:text-2xl dark:text-zinc-50">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          {hint}
        </p>
      ) : null}
      {children ? (
        <div className="mt-4 border-t border-zinc-900/[0.06] pt-4 dark:border-white/10">
          {children}
        </div>
      ) : null}
    </div>
  );
}
