import { listEodTrackerRows } from "@/app/actions/eod-tracker-rows";
import { EodTrackerView } from "@/components/eod/eod-tracker-view";
import { isEnvDevRuntime, isOpenAiConfigured } from "@/lib/app-runtime-mode";
import { getInitialJournalMonthFromRows } from "@/lib/eod-journal-month-default";

export default async function EodTrackerHomePage() {
  const rows = await listEodTrackerRows();
  const openAiConfigured = isOpenAiConfigured();
  const summarizeUnrestricted = isEnvDevRuntime();
  const initialJournalMonth = getInitialJournalMonthFromRows(rows);

  return (
    <EodTrackerView
      rows={rows}
      initialJournalMonth={initialJournalMonth}
      openAiConfigured={openAiConfigured}
      summarizeUnrestricted={summarizeUnrestricted}
    />
  );
}
