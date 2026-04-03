import { getFinancialAccounts } from "@/app/actions/financial-accounts";
import { getCategories } from "@/app/actions/categories";
import { getRecurringExpenses } from "@/app/actions/recurring-expenses";
import { RecurringExpenseManager } from "@/components/recurring-expense-manager";
import {
  ServerFlashToast,
  type ServerFlashMessage,
} from "@/components/server-flash-toast";
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
    sp.type === "transfer"
      ? "Card payment logged as a transfer (check Transfers and each account’s activity)."
      : sp.type === "income"
        ? "Income logged to your transactions."
        : "Expense logged to your transactions.";

  const recurringFlash: ServerFlashMessage | null = sp.error
    ? {
        kind: "error",
        title: "Could not complete action",
        message: sp.error,
      }
    : sp.logged === "1"
      ? { kind: "success", title: "Logged", message: loggedMsg }
      : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Recurring income & expenses
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Templates on a schedule. Use categories like ordinary transactions;
          logging creates a real entry for the date you pick. For card bill
          templates, choose <strong>Pay from</strong> (bank/e-wallet) to record
          a transfer onto the card (see Transfers and account activity); leave it
          blank to only reduce the card balance. Variable-amount templates skip
          a fixed price and ask for the amount when you log.
        </p>
      </div>

      <ServerFlashToast flash={recurringFlash} />

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
