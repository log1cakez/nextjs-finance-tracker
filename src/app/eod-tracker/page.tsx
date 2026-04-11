import { listEodTrackerRows } from "@/app/actions/eod-tracker-rows";
import { listEodTradingAccounts } from "@/app/actions/eod-trading-accounts";
import { EodTrackerView } from "@/components/eod/eod-tracker-view";
import { isEnvDevRuntime, isOpenAiConfigured } from "@/lib/app-runtime-mode";
import { getInitialJournalMonthFromRows } from "@/lib/eod-journal-month-default";

export default async function EodTrackerHomePage() {
  const [rows, tradingAccounts] = await Promise.all([
    listEodTrackerRows(),
    listEodTradingAccounts(),
  ]);
  const openAiConfigured = isOpenAiConfigured();
  const summarizeUnrestricted = isEnvDevRuntime();
  const initialJournalMonth = getInitialJournalMonthFromRows(rows);
  const serverToday = new Date().toISOString().slice(0, 10);

  return (
    <EodTrackerView
      rows={rows}
      tradingAccounts={tradingAccounts}
      initialJournalMonth={initialJournalMonth}
      serverToday={serverToday}
      openAiConfigured={openAiConfigured}
      summarizeUnrestricted={summarizeUnrestricted}
    />
  );
}
