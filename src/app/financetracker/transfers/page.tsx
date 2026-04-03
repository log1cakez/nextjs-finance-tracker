import { getAccountTransfers } from "@/app/actions/account-transfers";
import { getFinancialAccounts } from "@/app/actions/financial-accounts";
import { TransferManager } from "@/components/transfer-manager";
import { getPreferredCurrency } from "@/lib/preferences";

export default async function TransfersPage() {
  const [accountsList, transfers, preferredCurrency] = await Promise.all([
    getFinancialAccounts(),
    getAccountTransfers(),
    getPreferredCurrency(),
  ]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Transfers
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Move money between your own accounts without affecting income or
          expense totals.
        </p>
      </div>

      <TransferManager
        accountsList={accountsList}
        transfers={transfers}
        defaultCurrency={preferredCurrency}
      />
    </div>
  );
}
