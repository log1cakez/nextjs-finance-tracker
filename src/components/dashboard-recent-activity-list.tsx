import { deleteAccountTransfer } from "@/app/actions/account-transfers";
import type { DashboardRecentActivityItem } from "@/app/actions/dashboard-recent-activity";
import { deleteLendingPayment } from "@/app/actions/lending";
import { deleteTransaction } from "@/app/actions/transactions";
import { formatMoney, type FiatCurrency } from "@/lib/money";

function Badge({ kind }: { kind: DashboardRecentActivityItem["badge"] }) {
  const cls =
    kind === "TX"
      ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      : kind === "TRANSFER"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
        : "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200";
  const label = kind === "TX" ? "Tx" : kind === "TRANSFER" ? "Transfer" : "Lending";
  return (
    <span
      className={`ml-2 inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

export function AllActivityList({
  items,
}: {
  items: DashboardRecentActivityItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
        No activity yet. Add a transaction above, or record transfers and lending
        payments on their pages.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/50">
      {items.map((t) => {
        const positive = t.sign === 1;
        const rowKey = `${t.badge}-${t.id}`;
        return (
          <li
            key={rowKey}
            className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4"
          >
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium text-zinc-900 dark:text-zinc-50">
                {t.title}
                <Badge kind={t.badge} />
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t.subtitle}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
              <span
                className={
                  positive
                    ? "text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
                    : "text-base font-semibold tabular-nums text-rose-600 dark:text-rose-400"
                }
              >
                {positive ? "+" : "−"}
                {formatMoney(t.amountCents, t.currency as FiatCurrency)}
              </span>
              {t.badge === "TX" ? (
                <form action={deleteTransaction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="min-h-10 min-w-10 rounded-lg px-3 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 dark:active:bg-zinc-800"
                  >
                    Delete
                  </button>
                </form>
              ) : t.badge === "TRANSFER" ? (
                <form action={deleteAccountTransfer}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="min-h-10 min-w-10 rounded-lg px-3 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 dark:active:bg-zinc-800"
                  >
                    Delete
                  </button>
                </form>
              ) : (
                <form action={deleteLendingPayment}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="min-h-10 min-w-10 rounded-lg px-3 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 dark:active:bg-zinc-800"
                  >
                    Delete
                  </button>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DashboardRecentActivityList({
  items,
}: {
  items: DashboardRecentActivityItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
        No activity yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/50">
      {items.map((t) => {
        const positive = t.sign === 1;
        return (
          <li
            key={t.id}
            className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4"
          >
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium text-zinc-900 dark:text-zinc-50">
                {t.title}
                <Badge kind={t.badge} />
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t.subtitle}
              </p>
            </div>
            <span
              className={
                positive
                  ? "text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
                  : "text-base font-semibold tabular-nums text-rose-600 dark:text-rose-400"
              }
            >
              {positive ? "+" : "−"}
              {formatMoney(t.amountCents, t.currency as FiatCurrency)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

