import { listEodTrackerRows } from "@/app/actions/eod-tracker-rows";
import { EodTrackerView } from "@/components/eod/eod-tracker-view";
import { isEnvDevRuntime, isOpenAiConfigured } from "@/lib/app-runtime-mode";

export default async function EodTrackerHomePage() {
  const rows = await listEodTrackerRows();
  const openAiConfigured = isOpenAiConfigured();
  const summarizeUnrestricted = isEnvDevRuntime();

  return (
    <EodTrackerView
      rows={rows}
      openAiConfigured={openAiConfigured}
      summarizeUnrestricted={summarizeUnrestricted}
    />
  );
}
