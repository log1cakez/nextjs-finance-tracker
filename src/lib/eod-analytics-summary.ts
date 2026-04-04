/** Shape of an EOD row for analytics (matches `EodTrackerRow` from actions). */
export type EodRowAnalytics = {
  tradeDate: string;
  session: string;
  timeframeEof: string[];
  poi: string[];
  trend: string;
  position: string;
  riskType: string;
  result: string[];
  rrr: string;
  timeRange: string;
  entryTf: string;
  remarks: string;
};

export function eodRowsForCalendarMonth(
  rows: EodRowAnalytics[],
  year: number,
  month: number,
): EodRowAnalytics[] {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  return rows.filter((r) => r.tradeDate.slice(0, 7) === ym);
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function countField(rows: EodRowAnalytics[], field: keyof EodRowAnalytics): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = r[field];
    if (typeof v === "string" && v.trim()) {
      bump(out, v.trim());
    }
  }
  return out;
}

function countMultiField(
  rows: EodRowAnalytics[],
  field: "timeframeEof" | "poi" | "result",
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    for (const x of r[field]) {
      const t = x.trim();
      if (t) bump(out, t);
    }
  }
  return out;
}

const REMARKS_MAX = 280;

function compactTrade(row: EodRowAnalytics) {
  const remarks = row.remarks.trim();
  return {
    date: row.tradeDate.slice(0, 10),
    session: row.session || null,
    timeframeEof: row.timeframeEof,
    poi: row.poi,
    trend: row.trend || null,
    position: row.position || null,
    riskType: row.riskType || null,
    result: row.result,
    rrr: row.rrr || null,
    timeRange: row.timeRange || null,
    entryTf: row.entryTf || null,
    remarks:
      remarks.length > REMARKS_MAX ? `${remarks.slice(0, REMARKS_MAX)}…` : remarks || null,
  };
}

export type EodAnalyticsPayload = {
  periodLabel: string;
  yearMonth: string;
  totalEntries: number;
  uniqueTradeDates: number;
  /** Rows where at least one result tag is present */
  entriesWithAnyResultTag: number;
  /** Row counts (a row may count in more than one if it has multiple tags) */
  rowsWithWin: number;
  rowsWithLoss: number;
  rowsWithBreakEven: number;
  rowsWithDataOnly: number;
  /** Frequency of each result tag across all rows (multi-select) */
  resultTagFrequency: Record<string, number>;
  sessionCounts: Record<string, number>;
  trendCounts: Record<string, number>;
  positionCounts: Record<string, number>;
  riskTypeCounts: Record<string, number>;
  rrrCounts: Record<string, number>;
  entryTfCounts: Record<string, number>;
  timeframeEofCounts: Record<string, number>;
  poiCounts: Record<string, number>;
  weekdayCounts: Record<string, number>;
  trades: ReturnType<typeof compactTrade>[];
};

export function buildEodAnalyticsPayload(
  rows: EodRowAnalytics[],
  year: number,
  month: number,
): EodAnalyticsPayload {
  const periodLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;

  const dates = new Set(rows.map((r) => r.tradeDate.slice(0, 10)));
  const resultTagFrequency = countMultiField(rows, "result");

  const rowsWithWin = rows.filter((r) => r.result.includes("Win")).length;
  const rowsWithLoss = rows.filter((r) => r.result.includes("Loss")).length;
  const rowsWithBreakEven = rows.filter((r) => r.result.includes("Break Even")).length;
  const rowsWithDataOnly = rows.filter(
    (r) =>
      r.result.length > 0 &&
      r.result.every((x) => ["Data", "EOD", "Front Run"].includes(x)),
  ).length;

  const weekdayCounts: Record<string, number> = {};
  for (const r of rows) {
    const d = new Date(r.tradeDate);
    const w = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    bump(weekdayCounts, w);
  }

  return {
    periodLabel,
    yearMonth,
    totalEntries: rows.length,
    uniqueTradeDates: dates.size,
    entriesWithAnyResultTag: rows.filter((r) => r.result.length > 0).length,
    rowsWithWin,
    rowsWithLoss,
    rowsWithBreakEven,
    rowsWithDataOnly,
    resultTagFrequency,
    sessionCounts: countField(rows, "session"),
    trendCounts: countField(rows, "trend"),
    positionCounts: countField(rows, "position"),
    riskTypeCounts: countField(rows, "riskType"),
    rrrCounts: countField(rows, "rrr"),
    entryTfCounts: countField(rows, "entryTf"),
    timeframeEofCounts: countMultiField(rows, "timeframeEof"),
    poiCounts: countMultiField(rows, "poi"),
    weekdayCounts,
    trades: rows.map(compactTrade),
  };
}
