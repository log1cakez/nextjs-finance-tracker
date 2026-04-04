import { auth } from "@/auth";
import { getEodAiMonthSummaryForUser } from "@/lib/eod-ai-summary-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month")?.trim() ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
  }

  const summary = await getEodAiMonthSummaryForUser(userId, month);
  return Response.json({ summary });
}
