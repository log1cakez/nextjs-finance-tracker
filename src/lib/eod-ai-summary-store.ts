import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { eodAiMonthSummaries } from "@/db/schema";

export type EodAiMonthSummaryDto = {
  summaryText: string;
  tradeCount: number;
  periodLabel: string;
  updatedAt: string;
  sourceJournalStamp: string | null;
  summarizeRunCount: number;
};

export async function getEodAiMonthSummaryForUser(
  userId: string,
  yearMonth: string,
): Promise<EodAiMonthSummaryDto | null> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        summaryText: eodAiMonthSummaries.summaryText,
        tradeCount: eodAiMonthSummaries.tradeCount,
        periodLabel: eodAiMonthSummaries.periodLabel,
        updatedAt: eodAiMonthSummaries.updatedAt,
        sourceJournalStamp: eodAiMonthSummaries.sourceJournalStamp,
        aiSummarizeRunCount: eodAiMonthSummaries.aiSummarizeRunCount,
      })
      .from(eodAiMonthSummaries)
      .where(
        and(
          eq(eodAiMonthSummaries.userId, userId),
          eq(eodAiMonthSummaries.yearMonth, yearMonth),
        ),
      )
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      summaryText: r.summaryText,
      tradeCount: r.tradeCount,
      periodLabel: r.periodLabel,
      updatedAt: r.updatedAt.toISOString(),
      sourceJournalStamp: r.sourceJournalStamp ?? null,
      summarizeRunCount: r.aiSummarizeRunCount ?? 0,
    };
  } catch {
    return null;
  }
}

export async function upsertEodAiMonthSummary(
  userId: string,
  yearMonth: string,
  summaryText: string,
  periodLabel: string,
  tradeCount: number,
  sourceJournalStamp: string,
): Promise<{ runCount: number }> {
  const db = getDb();
  const now = new Date();
  const existing = await db
    .select({
      stamp: eodAiMonthSummaries.sourceJournalStamp,
      runCount: eodAiMonthSummaries.aiSummarizeRunCount,
    })
    .from(eodAiMonthSummaries)
    .where(
      and(eq(eodAiMonthSummaries.userId, userId), eq(eodAiMonthSummaries.yearMonth, yearMonth)),
    )
    .limit(1);
  const prev = existing[0];
  const nextRun = prev
    ? (prev.stamp ?? "") === sourceJournalStamp
      ? (prev.runCount ?? 0) + 1
      : 1
    : 1;

  await db
    .insert(eodAiMonthSummaries)
    .values({
      userId,
      yearMonth,
      summaryText,
      periodLabel,
      tradeCount,
      sourceJournalStamp,
      aiSummarizeRunCount: nextRun,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [eodAiMonthSummaries.userId, eodAiMonthSummaries.yearMonth],
      set: {
        summaryText,
        periodLabel,
        tradeCount,
        sourceJournalStamp,
        aiSummarizeRunCount: nextRun,
        updatedAt: now,
      },
    });
  return { runCount: nextRun };
}
