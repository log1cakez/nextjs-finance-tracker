import { auth } from "@/auth";
import { getEodTrackerRowsForExcel } from "@/app/actions/eod-tracker-rows";
import { buildEodExportXlsxBuffer } from "@/lib/build-eod-export-xlsx";

export const runtime = "nodejs";

function safeFileNameSegment(raw: string): string {
  const t = raw
    .trim()
    .replace(/[/\\:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
  return t.slice(0, 60) || "User";
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Sign in required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const displayName =
    session.user?.name?.trim() ||
    session.user?.email?.split("@")[0]?.trim() ||
    "User";
  const safeName = safeFileNameSegment(displayName);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `MIDAS_EODTracker_${safeName}_${date}.xlsx`;

  const rows = await getEodTrackerRowsForExcel(userId);
  const exportedAtIso = new Date().toISOString();
  const buffer = buildEodExportXlsxBuffer(rows, {
    exportedAtIso,
    userLabel: displayName,
  });

  const filenameStar = `UTF-8''${encodeURIComponent(filename)}`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=${filenameStar}`,
      "Cache-Control": "private, no-store",
    },
  });
}
