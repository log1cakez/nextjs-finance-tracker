import {
  deleteTransaction,
  type TransactionWithCategory,
} from "@/app/actions/transactions";
import { formatMoney, type FiatCurrency } from "@/lib/money";

export function TransactionList({ items }: { items: TransactionWithCategory[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
        No transactions yet. Add one above.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/50">
      {items.map((t) => {
        const isCardPaydown = t.reducesCreditBalance === true;
        return (
        <li
          key={t.id}
          className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4"
        >
          <div className="min-w-0 flex-1">
            <p className="break-words font-medium text-zinc-900 dark:text-zinc-50">
              {t.description}
              {isCardPaydown ? (
                <span className="ml-2 align-middle text-xs font-normal text-violet-600 dark:text-violet-400">
                  (card payment)
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {new Date(t.occurredAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              {t.financialAccount
                ? ` · ${t.financialAccount.name}`
                : ""}
              {t.category ? ` · ${t.category.name}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
            <span
              className={
                isCardPaydown
                  ? "text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
                  : t.kind === "income"
                    ? "text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
                    : "text-base font-semibold tabular-nums text-rose-600 dark:text-rose-400"
              }
            >
              {isCardPaydown || t.kind === "income" ? "+" : "−"}
              {formatMoney(t.amountCents, t.currency as FiatCurrency)}
            </span>
            <form action={deleteTransaction}>
              <input type="hidden" name="id" value={t.id} />
              <button
                type="submit"
                className="min-h-10 min-w-10 rounded-lg px-3 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 dark:active:bg-zinc-800"
              >
                Delete
              </button>
            </form>
          </div>
        </li>
        );
      })}
    </ul>
  );
}
