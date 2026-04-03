import { getCategories } from "@/app/actions/categories";
import { getAllUserActivity } from "@/app/actions/dashboard-recent-activity";
import { getFinancialAccounts } from "@/app/actions/financial-accounts";
import { TransactionForm } from "@/components/transaction-form";
import { AllActivityList } from "@/components/dashboard-recent-activity-list";
import { getPreferredCurrency } from "@/lib/preferences";

export default async function TransactionsPage() {
  const [activity, categoriesList, accountsList, preferredCurrency] =
    await Promise.all([
      getAllUserActivity(),
      getCategories(),
      getFinancialAccounts(),
      getPreferredCurrency(),
    ]);

  return (
    <div className="space-y-6 sm:space-y-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Transactions
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Income and expenses below use the form. The full log includes transfers
          and lending payments too (same as the dashboard feed), newest first.
          Export as Excel from your name menu while using Finance Tracker
          (same button switches to EOD export when you are on EOD Tracker).
        </p>
      </div>

      <TransactionForm
        categoriesList={categoriesList}
        accountsList={accountsList}
        defaultCurrency={preferredCurrency}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          All activity
        </h2>
        <AllActivityList items={activity} />
      </section>
    </div>
  );
}
