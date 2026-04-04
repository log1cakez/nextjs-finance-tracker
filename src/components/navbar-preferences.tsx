"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { setPreferredCurrency } from "@/app/actions/preferences";
import { SUPPORTED_CURRENCIES, type FiatCurrency } from "@/lib/money";
import { ThemeToggle } from "@/components/theme-toggle";

export function NavbarPreferences({
  initialCurrency,
  showCurrency,
}: {
  initialCurrency: FiatCurrency;
  /** When set, overrides path-based rule (default: currency only under `/financetracker`). */
  showCurrency?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const showCurrencyPicker =
    showCurrency ??
    Boolean(pathname != null && pathname.startsWith("/financetracker"));

  return (
    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
      {showCurrencyPicker ? (
        <label className="flex min-h-10 items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="hidden sm:inline">Currency</span>
          <select
            value={initialCurrency}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value as FiatCurrency;
              startTransition(async () => {
                await setPreferredCurrency(v);
                router.refresh();
              });
            }}
            className="min-h-10 min-w-[4.5rem] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base font-medium text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 sm:min-h-9 sm:px-2 sm:py-1.5 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            aria-label="Preferred currency"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <ThemeToggle />
    </div>
  );
}
