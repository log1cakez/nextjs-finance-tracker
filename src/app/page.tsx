import {
  getDashboardOverview,
  type CurrencyOverview,
} from "@/app/actions/dashboard-overview";
import {
  getMonthlyCashflowTrend,
  getRecentTransactions,
  getTransactionsForMonth,
} from "@/app/actions/transactions";
import { DashboardCashflowChart } from "@/components/dashboard-cashflow-chart";
import { DashboardOverviewSection } from "@/components/dashboard-overview-section";
import { ExportExcelButton } from "@/components/export-excel-button";
import { StatCard } from "@/components/stat-card";
import { TransactionList } from "@/components/transaction-list";
import { formatMoney, monthBounds, totalsByCurrency } from "@/lib/money";
import type { FiatCurrency } from "@/lib/money";
import { getPreferredCurrency } from "@/lib/preferences";

export const dynamic = "force-dynamic";

const emptyOverview: CurrencyOverview = {
  assetsFromActivityMinor: 0,
  liabilitiesFromActivityMinor: 0,
  lendingReceivablesOutstandingMinor: 0,
  lendingPayablesOutstandingMinor: 0,
  projectedIncomeMinor: 0,
  projectedExpenseMinor: 0,
  projectedIncomeYearlyMinor: 0,
  projectedExpenseYearlyMinor: 0,
};

export default async function DashboardPage() {
  const { start, end } = monthBounds();
  const preferredCurrency = await getPreferredCurrency();
  const [monthTx, recent, overviewData, cashflowTrend] = await Promise.all([
    getTransactionsForMonth(start, end),
    getRecentTransactions(8),
    getDashboardOverview(),
    getMonthlyCashflowTrend(preferredCurrency, 6),
  ]);

  const otherCurrency: FiatCurrency =
    preferredCurrency === "USD" ? "PHP" : "USD";
  const overview =
    overviewData?.byCurrency[preferredCurrency] ?? emptyOverview;
  const otherOverview =
    overviewData?.byCurrency[otherCurrency] ?? emptyOverview;
  const showOtherCurrency =
    otherOverview.assetsFromActivityMinor > 0 ||
    otherOverview.liabilitiesFromActivityMinor > 0 ||
    otherOverview.projectedIncomeMinor > 0 ||
    otherOverview.projectedExpenseMinor > 0 ||
    otherOverview.projectedIncomeYearlyMinor > 0 ||
    otherOverview.projectedExpenseYearlyMinor > 0;

  const totals = totalsByCurrency(monthTx);
  const t = totals[preferredCurrency];
  const net = t.income - t.expense;

  const monthLabel = start.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 sm:space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {monthLabel} · amounts below use {preferredCurrency} unless noted.
            Record transactions in {preferredCurrency} (navbar) so this month and
            charts match your entries.
          </p>
        </div>
        <ExportExcelButton className="shrink-0" />
      </div>

      <DashboardCashflowChart data={cashflowTrend} currency={preferredCurrency} />

      <DashboardOverviewSection
        preferredCurrency={preferredCurrency}
        overview={overview}
        otherCurrencyOverview={otherOverview}
        showOtherCurrency={showOtherCurrency}
      />

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          This month (actual)
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Income"
            value={formatMoney(t.income, preferredCurrency)}
            variant="income"
          />
          <StatCard
            label="Expenses"
            value={formatMoney(t.expense, preferredCurrency)}
            variant="expense"
          />
          <StatCard
            label="Net"
            value={formatMoney(net, preferredCurrency)}
            hint={net >= 0 ? "Ahead this month" : "Overspending"}
            variant="neutral"
          />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Recent activity
        </h2>
        <TransactionList items={recent} />
      </section>
    </div>
  );
}
