import { listEodTrackerRows } from "@/app/actions/eod-tracker-rows";
import { EodTrackerView } from "@/components/eod/eod-tracker-view";
import { getEnvRuntimeMode, isEnvDevRuntime, isOpenAiConfigured } from "@/lib/app-runtime-mode";

export default async function EodTrackerHomePage() {
  const [rows, envMode] = await Promise.all([
    listEodTrackerRows(),
    Promise.resolve(getEnvRuntimeMode()),
  ]);
  const openAiConfigured = isOpenAiConfigured();
  const summarizeUnrestricted = isEnvDevRuntime();

  return (
    <EodTrackerView
      rows={rows}
      openAiConfigured={openAiConfigured}
      summarizeUnrestricted={summarizeUnrestricted}
      envMode={envMode}
    />
  );
}
