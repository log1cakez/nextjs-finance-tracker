import type { CurrencyOverview } from "@/app/actions/dashboard-overview";
import { StatCard } from "@/components/stat-card";
import { formatMoney, type FiatCurrency } from "@/lib/money";

export function DashboardOverviewSection({
  preferredCurrency,
  overview,
  otherCurrencyOverview,
  showOtherCurrency,
}: {
  preferredCurrency: FiatCurrency;
  overview: CurrencyOverview;
  otherCurrencyOverview: CurrencyOverview;
  showOtherCurrency: boolean;
}) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Position & projections ({preferredCurrency})
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Assets and liabilities from account activity (not live balances).
          Projections use fixed-amount recurring templates only (variable
          amounts, e.g. credit cards, are excluded).
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Assets (from activity)"
            value={formatMoney(
              overview.assetsFromActivityMinor,
              preferredCurrency,
            )}
            hint="Sum of positive account nets"
            variant="income"
          />
          <StatCard
            label="Projected income / mo"
            value={formatMoney(
              overview.projectedIncomeMinor,
              preferredCurrency,
            )}
            variant="income"
          />
          <StatCard
            label="Projected income / yr"
            value={formatMoney(
              overview.projectedIncomeYearlyMinor,
              preferredCurrency,
            )}
            variant="income"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Liabilities (from activity)"
            value={formatMoney(
              overview.liabilitiesFromActivityMinor,
              preferredCurrency,
            )}
            hint="Sum of negative account nets"
            variant="expense"
          />
          <StatCard
            label="Projected expenses / mo"
            value={formatMoney(
              overview.projectedExpenseMinor,
              preferredCurrency,
            )}
            variant="expense"
          />
          <StatCard
            label="Projected expenses / yr"
            value={formatMoney(
              overview.projectedExpenseYearlyMinor,
              preferredCurrency,
            )}
            variant="expense"
          />
        </div>
      </div>

      {showOtherCurrency ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-xs text-zinc-600 sm:px-4 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            Also in {preferredCurrency === "USD" ? "PHP" : "USD"}
          </p>
          <p className="mt-2 break-words leading-relaxed tabular-nums sm:mt-1">
            Assets{" "}
            {formatMoney(
              otherCurrencyOverview.assetsFromActivityMinor,
              preferredCurrency === "USD" ? "PHP" : "USD",
            )}
            {" · "}
            Liabilities{" "}
            {formatMoney(
              otherCurrencyOverview.liabilitiesFromActivityMinor,
              preferredCurrency === "USD" ? "PHP" : "USD",
            )}
            {" · "}
            Proj. inc./mo{" "}
            {formatMoney(
              otherCurrencyOverview.projectedIncomeMinor,
              preferredCurrency === "USD" ? "PHP" : "USD",
            )}
            {" · "}
            Proj. exp./mo{" "}
            {formatMoney(
              otherCurrencyOverview.projectedExpenseMinor,
              preferredCurrency === "USD" ? "PHP" : "USD",
            )}
            {" · "}
            Proj. inc./yr{" "}
            {formatMoney(
              otherCurrencyOverview.projectedIncomeYearlyMinor,
              preferredCurrency === "USD" ? "PHP" : "USD",
            )}
            {" · "}
            Proj. exp./yr{" "}
            {formatMoney(
              otherCurrencyOverview.projectedExpenseYearlyMinor,
              preferredCurrency === "USD" ? "PHP" : "USD",
            )}
          </p>
        </div>
      ) : null}
    </section>
  );
}
