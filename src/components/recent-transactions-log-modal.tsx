"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEventHandler,
} from "react";
import { createPortal } from "react-dom";
import {
  getRecentTransactionsForAccount,
  type TransactionWithCategory,
} from "@/app/actions/transactions";
import { formatMoney, type FiatCurrency } from "@/lib/money";
import { Spinner } from "@/components/spinner";

const FETCH_LIMIT = 35;

export function AccountTransactionLogModal({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<TransactionWithCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    setItems(null);
    void getRecentTransactionsForAccount(accountId, FETCH_LIMIT)
      .then((data) => {
        setItems(data);
      })
      .catch(() => {
        setError("Could not load transactions.");
        setItems([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [accountId]);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const open = useCallback(() => {
    setItems(null);
    setError(null);
    dialogRef.current?.showModal();
    load();
  }, [load]);

  const onDialogPointerDown: PointerEventHandler<HTMLDialogElement> = (e) => {
    if (e.target === e.currentTarget) close();
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        Transaction log
      </button>

      {mounted
        ? createPortal(
            <dialog
              ref={dialogRef}
              aria-labelledby={`tx-log-title-${accountId}`}
              className="fixed left-1/2 top-1/2 z-[200] m-0 max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem))] min-h-[18rem] w-[min(26rem,calc(100vw-1.25rem))] max-w-[calc(100vw-1.25rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm [&:not([open])]:hidden [&[open]]:flex [&[open]]:flex-col dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 sm:w-[min(30rem,calc(100vw-2rem))] sm:max-w-[min(30rem,calc(100vw-2rem))] md:max-w-xl md:w-[min(36rem,calc(100vw-2.5rem))]"
              onClose={() => {
                setItems(null);
                setError(null);
                setLoading(false);
              }}
              onPointerDown={onDialogPointerDown}
              onClick={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 px-3 py-3 dark:border-zinc-800 sm:px-4 sm:py-3.5">
                  <h2
                    id={`tx-log-title-${accountId}`}
                    className="min-w-0 flex-1 text-base font-semibold tracking-tight"
                  >
                    <span
                      className="block break-words sm:truncate"
                      title={accountName}
                    >
                      {accountName}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      Recent transactions
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      close();
                    }}
                    className="-mr-1 -mt-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 sm:min-h-10 sm:min-w-10"
                    aria-label="Close"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div
                  className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] [-webkit-overflow-scrolling:touch] sm:px-4 sm:py-3 sm:pb-4"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {loading && items === null ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <Spinner size="md" decorative />
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Loading…
                      </p>
                    </div>
                  ) : error ? (
                    <p className="py-8 text-center text-sm text-rose-600 dark:text-rose-400">
                      {error}
                    </p>
                  ) : items && items.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No transactions for this account yet. Add one on the
                      Transactions page.
                    </p>
                  ) : items ? (
                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {items.map((t) => {
                        const isCardPaydown = t.reducesCreditBalance === true;
                        const isIncome = t.kind === "income";
                        return (
                          <li key={t.id} className="py-3 first:pt-1 sm:py-2.5">
                            <div className="flex items-start justify-between gap-3 sm:gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-medium leading-snug text-zinc-900 sm:line-clamp-2 dark:text-zinc-100">
                                  {t.description}
                                  {isCardPaydown ? (
                                    <span className="ml-1 text-xs font-normal text-violet-600 dark:text-violet-400">
                                      (card payment)
                                    </span>
                                  ) : null}
                                </p>
                                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                  {new Date(
                                    t.occurredAt,
                                  ).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                  {t.category ? ` · ${t.category.name}` : ""}
                                </p>
                              </div>
                              <span
                                className={
                                  isCardPaydown || isIncome
                                    ? "shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"
                                    : "shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400"
                                }
                              >
                                {isCardPaydown || isIncome ? "+" : "−"}
                                {formatMoney(
                                  t.amountCents,
                                  t.currency as FiatCurrency,
                                )}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </div>
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
