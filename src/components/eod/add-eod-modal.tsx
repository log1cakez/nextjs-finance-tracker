"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  createEodTrackerRowWithData,
  type CreateEodRowInput,
} from "@/app/actions/eod-tracker-rows";
import type { EodTradingAccount } from "@/app/actions/eod-trading-accounts";
import { centsToInputString, parseUsdToCents } from "@/lib/eod-money";
import {
  EOD_ENTRY_TF_OPTIONS,
  EOD_POI_OPTIONS,
  EOD_POSITION_OPTIONS,
  EOD_RESULT_OPTIONS,
  EOD_RISK_TYPE_OPTIONS,
  EOD_RRR_OPTIONS,
  EOD_SESSION_OPTIONS,
  EOD_TIMEFRAME_EOF_OPTIONS,
  EOD_TREND_OPTIONS,
} from "@/lib/eod-tracker-options";
import { useCenterToast } from "@/components/center-toast";
import { MultiTagPicker } from "@/components/eod/eod-tag-field";

export type AddEodModalProps = {
  open: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  initialData?: CreateEodRowInput;
  pending?: boolean;
  onSubmit?: (payload: CreateEodRowInput) => void;
  tradingAccounts: EodTradingAccount[];
};

type TimeFormatMode = "24h" | "12h";

function to12hParts(value24: string): { hh: string; mm: string; period: "AM" | "PM" } {
  const t = value24.trim();
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return { hh: "", mm: "", period: "AM" };
  const [hStr, mmRaw] = t.split(":");
  const mm = (mmRaw ?? "00").padStart(2, "0").slice(0, 2);
  const h = Number(hStr);
  if (!Number.isFinite(h) || h < 0 || h > 23) return { hh: "", mm: "", period: "AM" };
  return {
    hh: String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0"),
    mm,
    period: h >= 12 ? "PM" : "AM",
  };
}

function to24h(hh12: string, mm: string, period: "AM" | "PM"): string {
  if (!hh12.trim()) return "";
  const h = Number(hh12);
  const m = mm.trim() === "" ? 0 : Number(mm);
  if (!Number.isFinite(h) || h < 1 || h > 12 || !Number.isFinite(m) || m < 0 || m > 59) return "";
  return `${String((h % 12) + (period === "PM" ? 12 : 0)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Match `normalizeTimeRange` in `eod-tracker-rows` (ASCII + en/em dash). */
function splitRange(v: string): { start: string; end: string } {
  const t = v.trim();
  if (!t) return { start: "", end: "" };
  const p = t.split(/\s*[-–—]\s*/).map((x) => x.trim()).filter(Boolean);
  return { start: p[0] ?? "", end: p[1] ?? "" };
}

const MINUTE_OPTIONS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"] as const;

const MINUTES_24H = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const MULTI_VALUE_DELIMITER = " | ";

/** Parse HH:MM (24h) for 24h picker selects; empty/invalid → unset (not midnight). */
function parse24Parts(v: string): { hh: string; mm: string } {
  const t = v.trim();
  if (t && /^\d{2}:\d{2}$/.test(t)) {
    return { hh: t.slice(0, 2), mm: t.slice(3, 5) };
  }
  return { hh: "", mm: "" };
}

function to24HourString(hh: string, mm: string): string {
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(m) || m < 0 || m > 59) {
    return "";
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function splitMultiValue(raw: string): string[] {
  return raw
    .split(MULTI_VALUE_DELIMITER)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function AddEodModal({
  open,
  onClose,
  mode = "create",
  initialData,
  pending: externalPending = false,
  onSubmit,
  tradingAccounts,
}: AddEodModalProps) {
  const router = useRouter();
  const { showToast } = useCenterToast();
  const [localPending, startTransition] = useTransition();
  const pending = localPending || externalPending;
  const today = new Date().toISOString().slice(0, 10);
  const seed = useMemo<CreateEodRowInput>(
    () =>
      initialData ?? {
        tradeDate: today,
        session: "",
        timeframeEof: [],
        poi: [],
        trend: "",
        position: "",
        riskType: "",
        result: [],
        rrr: "",
        timeRange: "",
        entryTf: "",
        remarks: "",
        notionUrl: "",
        tradingAccountId: null,
        netPnlCents: null,
      },
    [initialData, today],
  );

  const [tradeDate, setTradeDate] = useState(seed.tradeDate);
  const [session, setSession] = useState<string[]>(splitMultiValue(seed.session));
  const [timeframeEof, setTimeframeEof] = useState<string[]>(seed.timeframeEof);
  const [poi, setPoi] = useState<string[]>(seed.poi);
  const [trend, setTrend] = useState<string[]>(splitMultiValue(seed.trend));
  const [position, setPosition] = useState<string[]>(splitMultiValue(seed.position));
  const [riskType, setRiskType] = useState<string[]>(splitMultiValue(seed.riskType));
  const [result, setResult] = useState<string[]>(seed.result);
  const [rrr, setRrr] = useState<string[]>(splitMultiValue(seed.rrr));
  const [timeFormat, setTimeFormat] = useState<TimeFormatMode>("24h");
  const [startTime, setStartTime] = useState(splitRange(seed.timeRange).start);
  const [endTime, setEndTime] = useState(splitRange(seed.timeRange).end);
  const [entryTf, setEntryTf] = useState<string[]>(splitMultiValue(seed.entryTf));
  const [remarks, setRemarks] = useState(seed.remarks);
  const [notionUrl, setNotionUrl] = useState(seed.notionUrl);
  const [tradingAccountId, setTradingAccountId] = useState<string | null>(
    seed.tradingAccountId ?? null,
  );
  const [netPnlInput, setNetPnlInput] = useState(() => centsToInputString(seed.netPnlCents ?? null));

  const reset = useCallback(() => {
    setTradeDate(seed.tradeDate); setSession(splitMultiValue(seed.session)); setTimeframeEof(seed.timeframeEof); setPoi(seed.poi);
    setTrend(splitMultiValue(seed.trend)); setPosition(splitMultiValue(seed.position)); setRiskType(splitMultiValue(seed.riskType)); setResult(seed.result);
    setRrr(splitMultiValue(seed.rrr)); setTimeFormat("24h"); const t = splitRange(seed.timeRange); setStartTime(t.start); setEndTime(t.end);
    setEntryTf(splitMultiValue(seed.entryTf)); setRemarks(seed.remarks); setNotionUrl(seed.notionUrl);
    setTradingAccountId(seed.tradingAccountId ?? null);
    setNetPnlInput(centsToInputString(seed.netPnlCents ?? null));
  }, [seed]);

  useEffect(() => { if (open) reset(); }, [open, reset]);
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [open, onClose]);
  if (!open) return null;

  const payload: CreateEodRowInput = {
    tradeDate,
    session: session.join(MULTI_VALUE_DELIMITER),
    timeframeEof,
    poi,
    trend: trend.join(MULTI_VALUE_DELIMITER),
    position: position.join(MULTI_VALUE_DELIMITER),
    riskType: riskType.join(MULTI_VALUE_DELIMITER),
    result,
    rrr: rrr.join(MULTI_VALUE_DELIMITER),
    timeRange: startTime && endTime ? `${startTime}-${endTime}` : startTime || endTime || "",
    entryTf: entryTf.join(MULTI_VALUE_DELIMITER),
    remarks,
    notionUrl,
    tradingAccountId,
    netPnlCents: parseUsdToCents(netPnlInput),
  };
  const submit = () => {
    if (netPnlInput.trim() && parseUsdToCents(netPnlInput) === null) {
      showToast({
        kind: "error",
        title: "Invalid net P&L",
        message: "Enter a valid dollar amount or leave the field blank.",
        timeoutMs: 4200,
      });
      return;
    }
    if (mode === "edit" && onSubmit) return onSubmit(payload);
    startTransition(async () => {
      const res = await createEodTrackerRowWithData(payload);
      if ("error" in res) {
        showToast({
          kind: "error",
          title: "Could not save row",
          message: res.error,
          timeoutMs: 6500,
        });
        return;
      }
      onClose(); reset(); router.refresh();
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))] dark:bg-black/70 sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-eod-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-[101] flex max-h-[min(calc(100dvh-1.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)),44rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950 sm:max-h-[min(92vh,44rem)] sm:rounded-2xl">
        <div className="border-b border-zinc-200 px-4 py-3 text-center dark:border-zinc-800">
          <h2 id="add-eod-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {mode === "edit" ? "Edit EOD" : "Add new EOD"}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-500">
            Fill in each column. Options match your tracker presets.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-center">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Date
            </span>
            <input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              className="eod-modal-date min-h-11 w-full touch-manipulation rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Trading account
            </span>
            <select
              value={tradingAccountId ?? ""}
              onChange={(e) => setTradingAccountId(e.target.value || null)}
              className="min-h-11 w-full touch-manipulation rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">None</option>
              {tradingAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <span className="block text-[11px] text-zinc-600 dark:text-zinc-500">
              Optional. Used for the accounts table and P&amp;L calendar rollups.
            </span>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Net P&amp;L (USD)
            </span>
            <input
              value={netPnlInput}
              onChange={(e) => setNetPnlInput(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 125.50 or -40"
              className="min-h-11 w-full touch-manipulation rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center font-mono text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <span className="block text-[11px] text-zinc-600 dark:text-zinc-500">
              Optional. Leave blank if you are journaling structure only.
            </span>
          </label>
          <MultiTagPicker label="Session" fieldKey="session" options={EOD_SESSION_OPTIONS} values={session} onChange={setSession} />
          <MultiTagPicker label="Timeframe EOF" fieldKey="timeframeEof" options={EOD_TIMEFRAME_EOF_OPTIONS} values={timeframeEof} onChange={setTimeframeEof} />
          <MultiTagPicker label="Point of Interest" fieldKey="poi" options={EOD_POI_OPTIONS} values={poi} onChange={setPoi} />
          <MultiTagPicker label="Trend" fieldKey="trend" options={EOD_TREND_OPTIONS} values={trend} onChange={setTrend} />
          <MultiTagPicker label="Position" fieldKey="position" options={EOD_POSITION_OPTIONS} values={position} onChange={setPosition} />
          <MultiTagPicker label="Risk Type" fieldKey="riskType" options={EOD_RISK_TYPE_OPTIONS} values={riskType} onChange={setRiskType} />
          <MultiTagPicker label="Result" fieldKey="result" options={EOD_RESULT_OPTIONS} values={result} onChange={setResult} />
          <MultiTagPicker label="RRR" fieldKey="rrr" options={EOD_RRR_OPTIONS} values={rrr} onChange={setRrr} />
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Time
            </span>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setTimeFormat("12h")}
                className={`min-h-10 min-w-[3rem] touch-manipulation rounded-md px-3 py-2 text-xs font-medium sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-1 ${timeFormat === "12h" ? "bg-amber-500 text-amber-950" : "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"}`}
              >
                12h
              </button>
              <button
                type="button"
                onClick={() => setTimeFormat("24h")}
                className={`min-h-10 min-w-[3rem] touch-manipulation rounded-md px-3 py-2 text-xs font-medium sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-1 ${timeFormat === "24h" ? "bg-amber-500 text-amber-950" : "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"}`}
              >
                24h
              </button>
            </div>
            {timeFormat === "24h" ? (
              <div className="mx-auto grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {(["start", "end"] as const).map((slot) => {
                  const v = slot === "start" ? startTime : endTime;
                  const { hh, mm } = parse24Parts(v);
                  const clearSlot = () => {
                    if (slot === "start") setStartTime("");
                    else setEndTime("");
                  };
                  const apply24 = (nextH: string, nextM: string) => {
                    const cv = to24HourString(nextH, nextM);
                    if (!cv) return;
                    if (slot === "start") setStartTime(cv);
                    else setEndTime(cv);
                  };
                  const setHour = (nextH: string) => {
                    if (nextH === "") return clearSlot();
                    const m = mm === "" ? "00" : mm;
                    apply24(nextH, m);
                  };
                  const setMinute = (nextM: string) => {
                    if (nextM === "") return clearSlot();
                    const h = hh === "" ? "00" : hh;
                    apply24(h, nextM);
                  };
                  const hourValue = hh === "" ? "" : hh;
                  const minuteValue =
                    mm === "" ? "" : MINUTES_24H.includes(mm) ? mm : "";
                  return (
                    <div
                      key={slot}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-center dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                        {slot === "start" ? "Start (24h)" : "End (24h)"}
                      </p>
                      <div className="mx-auto grid max-w-[12rem] grid-cols-2 gap-1">
                        <select
                          value={hourValue}
                          onChange={(e) => setHour(e.target.value)}
                          className="min-h-10 touch-manipulation rounded border border-zinc-300 bg-white px-2 py-1.5 text-center text-xs text-zinc-900 sm:min-h-0 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          aria-label={slot === "start" ? "Start hour (24h)" : "End hour (24h)"}
                        >
                          <option value="">—</option>
                          {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        <select
                          value={minuteValue}
                          onChange={(e) => setMinute(e.target.value)}
                          className="min-h-10 touch-manipulation rounded border border-zinc-300 bg-white px-2 py-1.5 text-center text-xs text-zinc-900 sm:min-h-0 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          aria-label={slot === "start" ? "Start minutes" : "End minutes"}
                        >
                          <option value="">—</option>
                          {MINUTES_24H.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mx-auto grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {(["start", "end"] as const).map((slot) => {
                  const v = slot === "start" ? startTime : endTime;
                  const p = to12hParts(v);
                  const clearSlot = () => {
                    if (slot === "start") setStartTime("");
                    else setEndTime("");
                  };
                  const apply12 = (nh: string, nm: string, pd: "AM" | "PM") => {
                    const cv = to24h(nh, nm, pd);
                    if (!cv) return;
                    if (slot === "start") setStartTime(cv);
                    else setEndTime(cv);
                  };
                  const setHour12 = (nh: string) => {
                    if (nh === "") return clearSlot();
                    const nm = p.mm === "" ? "00" : p.mm;
                    apply12(nh, nm, p.period);
                  };
                  const setMinute12 = (nm: string) => {
                    if (nm === "") return clearSlot();
                    const nh = p.hh === "" ? "12" : p.hh;
                    apply12(nh, nm, p.period);
                  };
                  const setPeriod12 = (pd: "AM" | "PM") => {
                    const nh = p.hh === "" ? "12" : p.hh;
                    const nm = p.mm === "" ? "00" : p.mm;
                    apply12(nh, nm, pd);
                  };
                  const minuteOk = (m: string) => (MINUTE_OPTIONS as readonly string[]).includes(m);
                  const hourValue = p.hh === "" ? "" : p.hh;
                  const minuteValue = p.mm === "" || !minuteOk(p.mm) ? "" : p.mm;
                  return (
                    <div
                      key={slot}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-center dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                        {slot === "start" ? "Start" : "End"}
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        <select
                          value={hourValue}
                          onChange={(e) => setHour12(e.target.value)}
                          className="min-h-10 touch-manipulation rounded border border-zinc-300 bg-white px-2 py-1 text-center text-xs text-zinc-900 sm:min-h-0 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          aria-label={slot === "start" ? "Start hour (12h)" : "End hour (12h)"}
                        >
                          <option value="">—</option>
                          {Array.from({ length: 12 }).map((_, i) => {
                            const h = String(i + 1).padStart(2, "0");
                            return (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            );
                          })}
                        </select>
                        <select
                          value={minuteValue}
                          onChange={(e) => setMinute12(e.target.value)}
                          className="min-h-10 touch-manipulation rounded border border-zinc-300 bg-white px-2 py-1 text-center text-xs text-zinc-900 sm:min-h-0 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          aria-label={slot === "start" ? "Start minutes (12h)" : "End minutes (12h)"}
                        >
                          <option value="">—</option>
                          {MINUTE_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <select
                          value={p.period}
                          onChange={(e) => setPeriod12(e.target.value as "AM" | "PM")}
                          className="min-h-10 touch-manipulation rounded border border-zinc-300 bg-white px-2 py-1 text-center text-xs text-zinc-900 sm:min-h-0 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          aria-label={slot === "start" ? "Start AM/PM" : "End AM/PM"}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </label>
          <MultiTagPicker label="Entry TF" fieldKey="entryTf" options={EOD_ENTRY_TF_OPTIONS} values={entryTf} onChange={setEntryTf} />
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Remarks
            </span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="min-h-[5.5rem] w-full touch-manipulation resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Notion link
            </span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://www.notion.so/..."
              value={notionUrl}
              onChange={(e) => setNotionUrl(e.target.value)}
              className="min-h-11 w-full touch-manipulation rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <span className="block text-[11px] text-zinc-600 dark:text-zinc-500">
              Optional. Opens in a new tab from the EOD table.
            </span>
          </label>
        </div>
        <div className="flex justify-stretch gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:justify-center">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 touch-manipulation rounded-lg px-3 py-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 sm:min-h-0 sm:flex-none sm:py-2 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !tradeDate}
            onClick={submit}
            className="min-h-11 flex-1 touch-manipulation rounded-lg bg-amber-500 px-3 py-2.5 text-xs font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50 sm:min-h-0 sm:flex-none sm:py-2"
          >
            {pending ? "Saving..." : mode === "edit" ? "Save changes" : "Save row"}
          </button>
        </div>
      </div>
    </div>
  );
}
