import * as XLSX from "xlsx";
import type { EodTrackerRow } from "@/app/actions/eod-tracker-rows";

function rowToRecord(r: EodTrackerRow) {
  const dt = new Date(r.tradeDate);
  const pnl =
    r.netPnlCents === null
      ? ""
      : (r.netPnlCents / 100).toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
        });
  return {
    Weekday: dt.toLocaleDateString(undefined, { weekday: "long" }),
    Date: dt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    "Trading account": r.tradingAccountName ?? "",
    "Net P&L (USD)": pnl,
    Session: r.session || "",
    "Timeframe EOF": r.timeframeEof.join("; "),
    "Point of interest": r.poi.join("; "),
    Trend: r.trend || "",
    Position: r.position || "",
    "Risk type": r.riskType || "",
    Result: r.result.join("; "),
    RRR: r.rrr || "",
    Time: r.timeRange || "",
    "Entry TF": r.entryTf || "",
    Remarks: r.remarks || "",
    "Notion URL": r.notionUrl || "",
    "Row ID": r.id,
    "Updated at (UTC)": r.updatedAt,
  };
}

export function buildEodExportXlsxBuffer(
  rows: EodTrackerRow[],
  options: { exportedAtIso: string; userLabel: string },
): Buffer {
  const records =
    rows.length > 0
      ? rows.map(rowToRecord)
      : [
          {
            Weekday: "—",
            Date: "",
            "Trading account": "",
            "Net P&L (USD)": "",
            Session: "",
            "Timeframe EOF": "",
            "Point of interest": "",
            Trend: "",
            Position: "",
            "Risk type": "",
            Result: "",
            RRR: "",
            Time: "",
            "Entry TF": "",
            Remarks: "No EOD rows to export.",
            "Notion URL": "",
            "Row ID": "",
            "Updated at (UTC)": "",
          },
        ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(records);
  XLSX.utils.book_append_sheet(wb, ws, "EOD Tracker");

  const meta = [
    ["MIDAS Capital — EOD Tracker export"],
    ["User", options.userLabel],
    ["Exported at (UTC)", options.exportedAtIso],
    ["Row count", String(rows.length)],
  ];
  const metaWs = XLSX.utils.aoa_to_sheet(meta);
  XLSX.utils.book_append_sheet(wb, metaWs, "About");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
