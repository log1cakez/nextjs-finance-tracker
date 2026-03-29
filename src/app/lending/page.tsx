import { getLendingsWithPayments } from "@/app/actions/lending";
import { LendingManager } from "@/components/lending-manager";
import { getPreferredCurrency } from "@/lib/preferences";

export default async function LendingPage() {
  const [items, preferredCurrency] = await Promise.all([
    getLendingsWithPayments(),
    getPreferredCurrency(),
  ]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Lending
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Track receivables (money others owe you) and payables (money you owe).
          Choose installment-style loans to record partial payments over time.
        </p>
      </div>

      <LendingManager
        items={items}
        defaultCurrency={preferredCurrency}
      />
    </div>
  );
}
