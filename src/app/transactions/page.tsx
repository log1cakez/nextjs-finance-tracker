import { getCategories } from "@/app/actions/categories";
import { getFinancialAccounts } from "@/app/actions/financial-accounts";
import { getAllTransactions } from "@/app/actions/transactions";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { getPreferredCurrency } from "@/lib/preferences";

export default async function TransactionsPage() {
  const [items, categoriesList, accountsList, preferredCurrency] =
    await Promise.all([
      getAllTransactions(),
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
          Full history, newest first. Export all data as Excel from your name
          menu → Export Excel (.xlsx).
        </p>
      </div>

      <TransactionForm
        categoriesList={categoriesList}
        accountsList={accountsList}
        defaultCurrency={preferredCurrency}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          All transactions
        </h2>
        <TransactionList items={items} />
      </section>
    </div>
  );
}
