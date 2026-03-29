import { getFinancialAccountsWithUsage } from "@/app/actions/financial-accounts";
import { AccountManager } from "@/components/account-manager";
import { getPreferredCurrency } from "@/lib/preferences";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [items, preferredCurrency] = await Promise.all([
    getFinancialAccountsWithUsage(),
    getPreferredCurrency(),
  ]);
  const sp = await searchParams;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Accounts
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Banks, e-wallets, crypto, forex, business, and cash — use these when
          recording transactions and recurring logs. You can set an optional
          starting balance when adding an account (not for credit cards — those
          use starting balance owed). For credit cards, template currency must
          match the card’s limit currency so usage stays accurate.
        </p>
      </div>

      {sp.error === "in_use" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          That account still has transactions, recurring templates, or
          transfers. Reassign or remove those before deleting the account.
        </p>
      ) : null}

      <AccountManager items={items} defaultCurrency={preferredCurrency} />
    </div>
  );
}
