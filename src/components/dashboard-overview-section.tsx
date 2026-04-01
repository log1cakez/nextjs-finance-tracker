import type { CurrencyOverview } from "@/app/actions/dashboard-overview";
import { StatCard } from "@/components/stat-card";
import { formatMoney, type FiatCurrency } from "@/lib/money";
import Link from "next/link";

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
          Assets and liabilities include each account’s recorded transactions and
          any starting balance you set when adding the account (same idea as the
          Accounts page), credit card balances owed for cards with a limit
          configured, and outstanding lending. Transfers between accounts are
          reflected in account nets (and in card utilization for credit cards
          with limits). Not live bank balances. Projections include fixed-amount recurring templates plus
          lending outstanding (receivables as projected income, payables as
          projected expense) and credit card balances owed. Projected expenses
          are split as Scheduled + Existing obligations. Variable recurring
          amounts are excluded.
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
            hint="Positive nets + starting balances + receivables"
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
            hint="Credit owed + other nets + payables"
            variant="expense"
          />
          <StatCard
            label="Projected expenses / mo"
            value={formatMoney(
              overview.projectedExpenseMinor,
              preferredCurrency,
            )}
            hint={`Scheduled ${formatMoney(
              overview.projectedExpenseScheduledMinor,
              preferredCurrency,
            )} + Existing obligations ${formatMoney(
              overview.projectedExpenseExistingObligationsMinor,
              preferredCurrency,
            )}`}
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

      {overview.creditCardOutstandingMinor > 0 ? (
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Credit cards ({preferredCurrency})
          </span>
          :{" "}
          {formatMoney(
            overview.creditCardOutstandingMinor,
            preferredCurrency,
          )}{" "}
          owed on cards with a credit limit set (same utilization as the Accounts
          page) is included in liabilities above.{" "}
          <Link
            href="/accounts"
            className="font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
          >
            Manage accounts
          </Link>
        </p>
      ) : null}

      {overview.lendingReceivablesOutstandingMinor > 0 ||
      overview.lendingPayablesOutstandingMinor > 0 ? (
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Lending in {preferredCurrency}
          </span>
          :{" "}
          {formatMoney(
            overview.lendingReceivablesOutstandingMinor,
            preferredCurrency,
          )}{" "}
          receivable and{" "}
          {formatMoney(
            overview.lendingPayablesOutstandingMinor,
            preferredCurrency,
          )}{" "}
          payable are already included in assets and liabilities above.{" "}
          <Link
            href="/lending"
            className="font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
          >
            Manage lending
          </Link>
        </p>
      ) : null}

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
