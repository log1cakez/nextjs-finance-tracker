import type { ReactNode } from "react";
import type { EodTrackerRow } from "@/app/actions/eod-tracker-rows";
import { listEodTrackerRows } from "@/app/actions/eod-tracker-rows";
import { AddEodLauncher } from "@/components/eod/add-eod-launcher";
import { EodRowManageActions } from "@/components/eod/eod-row-manage-actions";
import type { EodPillTone } from "@/lib/eod-tracker-options";
import { eodPillClass, getEodOptionTone } from "@/lib/eod-tracker-options";

function PillList({
  items,
  fieldKey,
  align = "center",
}: {
  items: string[];
  fieldKey: string;
  align?: "center" | "start";
}) {
  if (items.length === 0) {
    return <span className="text-zinc-500">—</span>;
  }
  return (
    <div
      className={`flex min-w-0 w-full flex-col gap-1 ${align === "start" ? "items-start" : "items-center"}`}
    >
      {items.map((v) => (
        <span
          key={v}
          className={eodPillClass(getEodOptionTone(fieldKey, v) as EodPillTone, {
            wrap: true,
          })}
        >
          {v}
        </span>
      ))}
    </div>
  );
}

function PillOne({ value, fieldKey }: { value: string; fieldKey: string }) {
  if (!value) {
    return <span className="text-zinc-500">—</span>;
  }
  return (
    <span
      className={eodPillClass(getEodOptionTone(fieldKey, value) as EodPillTone, {
        wrap: true,
      })}
    >
      {value}
    </span>
  );
}

function FieldLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-zinc-800/80 pb-2 last:border-b-0 last:pb-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <div className="text-left text-xs text-zinc-200">{children}</div>
    </div>
  );
}

function EodMobileRowCard({ row }: { row: EodTrackerRow }) {
  const dt = new Date(row.tradeDate);
  const weekday = dt.toLocaleDateString(undefined, { weekday: "long" });
  const dateLabel = dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <PillOne value={weekday} fieldKey="weekday" />
          <span className="text-xs text-zinc-400">{dateLabel}</span>
        </div>
        <EodRowManageActions
          rowId={row.id}
          initial={{
            tradeDate: row.tradeDate.slice(0, 10),
            session: row.session,
            timeframeEof: row.timeframeEof,
            poi: row.poi,
            trend: row.trend,
            position: row.position,
            riskType: row.riskType,
            result: row.result,
            rrr: row.rrr,
            timeRange: row.timeRange,
            entryTf: row.entryTf,
            remarks: row.remarks,
            notionUrl: row.notionUrl,
          }}
        />
      </div>
      <div className="space-y-2.5">
        <FieldLine label="Session">
          <PillOne value={row.session} fieldKey="session" />
        </FieldLine>
        <FieldLine label="Timeframe EOF">
          <PillList items={row.timeframeEof} fieldKey="timeframeEof" align="start" />
        </FieldLine>
        <FieldLine label="Point of interest">
          <PillList items={row.poi} fieldKey="poi" align="start" />
        </FieldLine>
        <FieldLine label="Trend">
          <PillOne value={row.trend} fieldKey="trend" />
        </FieldLine>
        <FieldLine label="Position">
          <PillOne value={row.position} fieldKey="position" />
        </FieldLine>
        <FieldLine label="Risk">
          <PillOne value={row.riskType} fieldKey="riskType" />
        </FieldLine>
        <FieldLine label="Result">
          <PillList items={row.result} fieldKey="result" align="start" />
        </FieldLine>
        <FieldLine label="RRR">
          <PillOne value={row.rrr} fieldKey="rrr" />
        </FieldLine>
        <FieldLine label="Time">
          {row.timeRange ? (
            <span className="whitespace-pre-wrap font-mono text-zinc-300">{row.timeRange}</span>
          ) : (
            <span className="text-zinc-500">—</span>
          )}
        </FieldLine>
        <FieldLine label="Entry TF">
          <PillOne value={row.entryTf} fieldKey="entryTf" />
        </FieldLine>
        <FieldLine label="Remarks">
          {row.remarks ? (
            <span className="whitespace-pre-wrap text-zinc-300">{row.remarks}</span>
          ) : (
            <span className="text-zinc-500">—</span>
          )}
        </FieldLine>
        <FieldLine label="Notion">
          {row.notionUrl.trim() ? (
            <a
              href={row.notionUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center font-medium text-amber-400 underline underline-offset-2 touch-manipulation"
            >
              Open link
            </a>
          ) : (
            <span className="text-zinc-500">—</span>
          )}
        </FieldLine>
      </div>
    </li>
  );
}

export default async function EodTrackerHomePage() {
  const rows = await listEodTrackerRows();

  return (
    <div className="space-y-4 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">EOD Tracker</h1>
          <p className="mt-1 max-w-2xl text-xs italic leading-relaxed text-zinc-600 sm:text-sm dark:text-zinc-400">
            &ldquo;The edge is not in calling every move—it is in showing up, logging the
            session, and refining tomorrow with what you learned today.&rdquo;
          </p>
        </div>
        <div className="flex w-full shrink-0 justify-stretch sm:w-auto sm:justify-end">
          <AddEodLauncher />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-10 text-center text-sm text-zinc-400">
          No EOD rows yet. Use <strong className="text-zinc-200">Add new EOD</strong> above to create
          your first one.
        </div>
      ) : (
        <>
          <ul className="flex list-none flex-col gap-3 md:hidden">
            {rows.map((row) => (
              <EodMobileRowCard key={row.id} row={row} />
            ))}
          </ul>
          <div className="hidden min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 md:block">
            <table className="w-full table-fixed border-collapse text-center text-xs">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[5%]" />
            <col className="w-[3%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[3%]" />
            <col className="w-[4%]" />
            <col className="w-[3%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="bg-zinc-900/70 text-zinc-400">
            <tr className="[&>th]:border-b [&>th]:border-zinc-800 [&>th]:px-2.5 [&>th]:py-2.5 [&>th]:text-center [&>th]:align-bottom [&>th]:font-medium [&>th]:leading-snug [&>th]:whitespace-normal sm:[&>th]:px-3 md:[&>th]:px-3.5">
              <th className="min-w-[5.5rem]">Weekday</th>
              <th>Session</th>
              <th>Timeframe EOF</th>
              <th>Point of Interest</th>
              <th>Trend</th>
              <th>Pos.</th>
              <th>Risk</th>
              <th>Result</th>
              <th>RRR</th>
              <th>Time</th>
              <th>Entry</th>
              <th>Remarks</th>
              <th>Notion</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="text-zinc-200">
              {rows.map((row) => {
                  const dt = new Date(row.tradeDate);
                  const weekday = dt.toLocaleDateString(undefined, {
                    weekday: "long",
                  });
                  const dateLabel = dt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  return (
                    <tr
                      key={row.id}
                      className="align-top [&>td]:min-w-0 [&>td]:border-b [&>td]:border-zinc-800/60 [&>td]:px-2.5 [&>td]:py-2.5 [&>td]:text-center sm:[&>td]:px-3 md:[&>td]:px-3.5"
                    >
                      <td className="whitespace-nowrap">
                        <PillOne value={weekday} fieldKey="weekday" />
                      </td>
                      <td>
                        <PillOne value={row.session} fieldKey="session" />
                      </td>
                      <td>
                        <PillList items={row.timeframeEof} fieldKey="timeframeEof" />
                      </td>
                      <td>
                        <PillList items={row.poi} fieldKey="poi" />
                      </td>
                      <td>
                        <PillOne value={row.trend} fieldKey="trend" />
                      </td>
                      <td>
                        <PillOne value={row.position} fieldKey="position" />
                      </td>
                      <td>
                        <PillOne value={row.riskType} fieldKey="riskType" />
                      </td>
                      <td>
                        <PillList items={row.result} fieldKey="result" />
                      </td>
                      <td>
                        <PillOne value={row.rrr} fieldKey="rrr" />
                      </td>
                      <td className="min-w-0 break-words text-center text-zinc-300 whitespace-pre-wrap">
                        {row.timeRange || "—"}
                      </td>
                      <td>
                        <PillOne value={row.entryTf} fieldKey="entryTf" />
                      </td>
                      <td className="min-w-0 break-words text-center text-zinc-300">
                        {row.remarks || "-"}
                      </td>
                      <td className="min-w-0 text-center">
                        {row.notionUrl.trim() ? (
                          <a
                            href={row.notionUrl.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block max-w-full break-all text-[11px] font-medium text-amber-400 underline-offset-2 hover:underline"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="min-w-0 break-words text-center text-zinc-400 leading-tight">
                        {dateLabel}
                      </td>
                      <td className="text-center">
                        <div className="flex flex-wrap justify-center">
                          <EodRowManageActions
                            rowId={row.id}
                            initial={{
                              tradeDate: row.tradeDate.slice(0, 10),
                              session: row.session,
                              timeframeEof: row.timeframeEof,
                              poi: row.poi,
                              trend: row.trend,
                              position: row.position,
                              riskType: row.riskType,
                              result: row.result,
                              rrr: row.rrr,
                              timeRange: row.timeRange,
                              entryTf: row.entryTf,
                              remarks: row.remarks,
                              notionUrl: row.notionUrl,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}
