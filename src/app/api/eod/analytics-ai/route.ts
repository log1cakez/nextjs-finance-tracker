import { auth } from "@/auth";
import { getEodTrackerRowsForExcel } from "@/app/actions/eod-tracker-rows";
import { isEnvDevRuntime } from "@/lib/app-runtime-mode";
import { isLocalDateInLastThreeDaysOfYearMonth } from "@/lib/eod-ai-month-window";
import { buildEodAnalyticsPayload, eodRowsForCalendarMonth } from "@/lib/eod-analytics-summary";
import { upsertEodAiMonthSummary } from "@/lib/eod-ai-summary-store";
import { eodMonthJournalDataStamp } from "@/lib/eod-journal-month-stamp";

export const runtime = "nodejs";

const SYSTEM = `You are an experienced trading journal reviewer. The user logs end-of-day (EOD) trading sessions in a structured journal (sessions, timeframes, POI, trend, position, risk, results, RRR, remarks—not dollar P&L).

Your job: interpret ONLY the JSON stats and per-entry summaries provided. Write a short, supportive review for that calendar month.

Structure your answer with clear sections:
1) **Month snapshot** — 2–4 sentences on overall consistency, frequency, and what the numbers suggest.
2) **What went well** — specific patterns backed by the data (e.g. sessions, results mix, risk discipline).
3) **Gaps / what to tighten** — honest, non-judgmental areas to improve (logging completeness, risk type mix, over-trading certain setups, etc.).
4) **Next focus** — one concrete habit or metric to track next month.

Rules:
- Do not invent trades, P&L, or facts not implied by the data. If the month is empty or sparse, say so and suggest logging habits.
- This is educational journaling feedback, not financial advice.
- Keep total length under ~450 words. Use markdown **bold** for section titles only.`;

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const monthRaw =
    typeof body === "object" && body !== null && "month" in body
      ? String((body as { month: unknown }).month)
      : "";
  const m = /^(\d{4})-(\d{2})$/.exec(monthRaw.trim());
  if (!m) {
    return Response.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    return Response.json({ error: "Invalid month range." }, { status: 400 });
  }

  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        error:
          "AI summaries need OPENAI_API_KEY on the server. Add it to .env.local and restart.",
      },
      { status: 503 },
    );
  }

  if (!isEnvDevRuntime()) {
    if (!isLocalDateInLastThreeDaysOfYearMonth(new Date(), yearMonth)) {
      return Response.json(
        {
          error:
            "In production, new summaries can only be generated during the last three calendar days of that month (your local time). You can still read saved summaries for past months.",
        },
        { status: 403 },
      );
    }
  }

  const allRows = await getEodTrackerRowsForExcel(userId);
  const monthRows = eodRowsForCalendarMonth(allRows, year, month);
  const journalDataStamp = eodMonthJournalDataStamp(allRows, yearMonth);
  const payload = buildEodAnalyticsPayload(monthRows, year, month);

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Analyze this EOD journal data for ${payload.periodLabel} (${payload.yearMonth}):\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
      temperature: 0.55,
      max_tokens: 1400,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      detail = err?.error?.message ?? "";
    } catch {
      detail = (await res.text()).slice(0, 400);
    }
    return Response.json(
      { error: "The AI service returned an error.", detail: detail || undefined },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    return Response.json({ error: "Empty response from AI." }, { status: 502 });
  }

  const savedAt = new Date();
  let persisted = true;
  try {
    await upsertEodAiMonthSummary(
      userId,
      payload.yearMonth,
      text,
      payload.periodLabel,
      payload.totalEntries,
      journalDataStamp,
    );
  } catch {
    persisted = false;
  }

  return Response.json({
    text,
    month: payload.yearMonth,
    periodLabel: payload.periodLabel,
    tradeCount: payload.totalEntries,
    journalDataStamp,
    savedAt: persisted ? savedAt.toISOString() : null,
    persisted,
    persistWarning: persisted
      ? undefined
      : "Summary was generated but not saved. Run `npm run db:migrate` or `db:push` for table eod_ai_month_summary.",
  });
}
