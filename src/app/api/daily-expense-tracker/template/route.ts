import { auth } from "@/auth";
import { buildDailyExpenseTrackerXlsxBuffer } from "@/lib/daily-expense-tracker-xlsx";
import { getPreferredCurrency } from "@/lib/preferences";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const preferredCurrency = await getPreferredCurrency();
  const buffer = await buildDailyExpenseTrackerXlsxBuffer(userId, {
    preferredCurrency,
  });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `MIDAS_Daily_Expense_Tracker_${date}.xlsx`;
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
