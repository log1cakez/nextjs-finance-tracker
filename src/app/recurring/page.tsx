import { getFinancialAccounts } from "@/app/actions/financial-accounts";
import { getCategories } from "@/app/actions/categories";
import { getRecurringExpenses } from "@/app/actions/recurring-expenses";
import { RecurringExpenseManager } from "@/components/recurring-expense-manager";
import { getPreferredCurrency } from "@/lib/preferences";

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    logged?: string;
    type?: string;
  }>;
}) {
  const [items, accountsList, categoriesList, preferredCurrency, sp] =
    await Promise.all([
      getRecurringExpenses(),
      getFinancialAccounts(),
      getCategories(),
      getPreferredCurrency(),
      searchParams,
    ]);

  const expenseCategories = categoriesList.filter((c) => c.kind === "expense");
  const incomeCategories = categoriesList.filter((c) => c.kind === "income");

  const loggedMsg =
    sp.type === "income"
      ? "Income logged to your transactions."
      : "Expense logged to your transactions.";

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Recurring income & expenses
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Templates on a schedule. Use categories like ordinary transactions;
          logging creates a real entry for the date you pick.
        </p>
      </div>

      {sp.logged === "1" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
          {loggedMsg}
        </p>
      ) : null}

      {sp.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100">
          {sp.error}
        </p>
      ) : null}

      <RecurringExpenseManager
        items={items}
        accountsList={accountsList}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        defaultCurrency={preferredCurrency}
      />
    </div>
  );
}
