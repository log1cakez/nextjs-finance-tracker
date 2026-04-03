import { getDashboardUpcomingDueDates } from "@/app/actions/dashboard-due-dates";
import {
  getDashboardOverview,
  type CurrencyOverview,
} from "@/app/actions/dashboard-overview";
import { getDashboardRecentActivity } from "@/app/actions/dashboard-recent-activity";
import {
  getCurrentMonthExpensesByCurrency,
  getMonthlyCashflowTrend,
} from "@/app/actions/transactions";
import { DashboardCashflowChart } from "@/components/dashboard-cashflow-chart";
import { DashboardDueDatesSection } from "@/components/dashboard-due-dates-section";
import { DashboardOverviewSection } from "@/components/dashboard-overview-section";
import { DashboardRecentActivityList } from "@/components/dashboard-recent-activity-list";
import { ExpenseMoodGif } from "@/components/expense-mood-gif";
import { StatCard } from "@/components/stat-card";
import { getExpenseMoodTier } from "@/lib/expense-mood";
import { formatMoney, type FiatCurrency } from "@/lib/money";
import { getPreferredCurrency } from "@/lib/preferences";

export const dynamic = "force-dynamic";

const emptyOverview: CurrencyOverview = {
  assetsFromActivityMinor: 0,
  liabilitiesFromActivityMinor: 0,
  creditCardOutstandingMinor: 0,
  lendingReceivablesOutstandingMinor: 0,
  lendingPayablesOutstandingMinor: 0,
  projectedIncomeMinor: 0,
  projectedExpenseFromTransactionsMinor: 0,
  projectedExpenseScheduledMinor: 0,
  projectedExpenseExistingObligationsMinor: 0,
  projectedExpenseMinor: 0,
  projectedIncomeYearlyMinor: 0,
  projectedExpenseYearlyMinor: 0,
};

export default async function DashboardPage() {
  const preferredCurrency = await getPreferredCurrency();
  const [recent, overviewData, cashflowTrend, dueDates, monthExpenses] =
    await Promise.all([
      getDashboardRecentActivity(10),
      getDashboardOverview(),
      getMonthlyCashflowTrend(preferredCurrency, 6),
      getDashboardUpcomingDueDates(),
      getCurrentMonthExpensesByCurrency(),
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
    otherOverview.creditCardOutstandingMinor > 0 ||
    otherOverview.projectedIncomeMinor > 0 ||
    otherOverview.projectedExpenseMinor > 0 ||
    otherOverview.projectedIncomeYearlyMinor > 0 ||
    otherOverview.projectedExpenseYearlyMinor > 0;

  const expensesByCurrency = monthExpenses ?? { USD: 0, PHP: 0 };
  const monthTitle = new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const showMonthExpensesOther = expensesByCurrency[otherCurrency] > 0;
  const expenseMoodTier = getExpenseMoodTier(
    expensesByCurrency[preferredCurrency],
    overview.projectedExpenseMinor,
  );

  return (
    <div className="space-y-6 sm:space-y-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Position and projections use {preferredCurrency} where noted. The chart
          shows the last six months of activity in that currency.
        </p>
      </div>

      <div
        className={
          showMonthExpensesOther
            ? "mx-auto w-full max-w-4xl"
            : "mx-auto w-full max-w-md"
        }
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:items-start">
          <div className="w-full max-w-md shrink-0">
            <StatCard
              label={`Total expenses — ${preferredCurrency} (${monthTitle})`}
              value={formatMoney(
                expensesByCurrency[preferredCurrency],
                preferredCurrency,
              )}
              hint="Month-to-date: expense entries, card paydowns, and payable loan payments. Transfers excluded. Reaction compares spend to your projected monthly burn, prorated for today."
              variant="expense"
            >
              <ExpenseMoodGif tier={expenseMoodTier} />
            </StatCard>
          </div>
          {showMonthExpensesOther ? (
            <div className="w-full max-w-md shrink-0">
              <StatCard
                label={`Total expenses — ${otherCurrency} (${monthTitle})`}
                value={formatMoney(
                  expensesByCurrency[otherCurrency],
                  otherCurrency,
                )}
                hint="Same month window: expense transactions and payable lending payments in this currency."
                variant="expense"
              />
            </div>
          ) : null}
        </div>
      </div>

      <DashboardCashflowChart data={cashflowTrend} currency={preferredCurrency} />

      <DashboardOverviewSection
        preferredCurrency={preferredCurrency}
        overview={overview}
        otherCurrencyOverview={otherOverview}
        showOtherCurrency={showOtherCurrency}
      />

      <DashboardDueDatesSection items={dueDates ?? []} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Recent activity
        </h2>
        <DashboardRecentActivityList items={recent} />
      </section>
    </div>
  );
}
