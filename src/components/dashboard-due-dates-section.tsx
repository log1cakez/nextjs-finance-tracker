import type { DashboardDueDateEntry } from "@/app/actions/dashboard-due-dates";
import Link from "next/link";

function formatDueDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  return local.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function KindBadge({ kind }: { kind: DashboardDueDateEntry["kind"] }) {
  if (kind === "income") {
    return (
      <span className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
        Income
      </span>
    );
  }
  if (kind === "credit_payment") {
    return (
      <span className="shrink-0 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
        Card
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
      Expense
    </span>
  );
}

export function DashboardDueDatesSection({
  items,
}: {
  items: DashboardDueDateEntry[];
}) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-950/50 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Incoming & upcoming due dates
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Next occurrence for each recurring template and credit card payment
            days you set on Accounts. Dates use a simple calendar (UTC); log on
            the day that matches your bank.
          </p>
        </div>
        <Link
          href="/recurring"
          className="mt-2 shrink-0 text-xs font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400 sm:mt-0"
        >
          Recurring
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing scheduled yet. Add{" "}
          <Link
            href="/recurring"
            className="font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
          >
            recurring income or expenses
          </Link>{" "}
          or set a payment due day on a{" "}
          <Link
            href="/accounts"
            className="font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
          >
            credit card
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-start gap-2 py-3 first:pt-0 sm:gap-3"
            >
              <div className="w-full min-w-[7.5rem] shrink-0 text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-300 sm:w-28">
                {formatDueDateLabel(row.dateKey)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <KindBadge kind={row.kind} />
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {row.title}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {row.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
