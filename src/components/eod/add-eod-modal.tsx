"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  createEodTrackerRowWithData,
  type CreateEodRowInput,
} from "@/app/actions/eod-tracker-rows";
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
import { MultiTagPicker, SingleTagPicker } from "@/components/eod/eod-tag-field";

export type AddEodModalProps = {
  open: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  initialData?: CreateEodRowInput;
  pending?: boolean;
  onSubmit?: (payload: CreateEodRowInput) => void;
};

type TimeFormatMode = "24h" | "12h";

function to12hParts(value24: string): { hh: string; mm: string; period: "AM" | "PM" } {
  if (!value24 || !/^\d{2}:\d{2}$/.test(value24)) return { hh: "12", mm: "00", period: "AM" };
  const [hStr, mm] = value24.split(":");
  const h = Number(hStr);
  return { hh: String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0"), mm, period: h >= 12 ? "PM" : "AM" };
}

function to24h(hh12: string, mm: string, period: "AM" | "PM"): string {
  const h = Number(hh12);
  const m = Number(mm);
  if (!Number.isFinite(h) || h < 1 || h > 12 || !Number.isFinite(m) || m < 0 || m > 59) return "";
  return `${String((h % 12) + (period === "PM" ? 12 : 0)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function splitRange(v: string): { start: string; end: string } {
  const p = v.split("-").map((x) => x.trim()).filter(Boolean);
  return { start: p[0] ?? "", end: p[1] ?? "" };
}

const MINUTE_OPTIONS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"] as const;

const MINUTES_24H = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/** Parse HH:MM (24h) for 24h picker selects; empty/invalid → defaults for display. */
function parse24Parts(v: string): { hh: string; mm: string } {
  if (v && /^\d{2}:\d{2}$/.test(v)) {
    return { hh: v.slice(0, 2), mm: v.slice(3, 5) };
  }
  return { hh: "00", mm: "00" };
}

function to24HourString(hh: string, mm: string): string {
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(m) || m < 0 || m > 59) {
    return "";
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function AddEodModal({ open, onClose, mode = "create", initialData, pending: externalPending = false, onSubmit }: AddEodModalProps) {
  const router = useRouter();
  const [localPending, startTransition] = useTransition();
  const pending = localPending || externalPending;
  const today = new Date().toISOString().slice(0, 10);
  const seed = useMemo<CreateEodRowInput>(() => initialData ?? {
    tradeDate: today, session: "", timeframeEof: [], poi: [], trend: "", position: "",
    riskType: "", result: [], rrr: "", timeRange: "", entryTf: "", remarks: "", notionUrl: "",
  }, [initialData, today]);

  const [tradeDate, setTradeDate] = useState(seed.tradeDate);
  const [session, setSession] = useState(seed.session);
  const [timeframeEof, setTimeframeEof] = useState<string[]>(seed.timeframeEof);
  const [poi, setPoi] = useState<string[]>(seed.poi);
  const [trend, setTrend] = useState(seed.trend);
  const [position, setPosition] = useState(seed.position);
  const [riskType, setRiskType] = useState(seed.riskType);
  const [result, setResult] = useState<string[]>(seed.result);
  const [rrr, setRrr] = useState(seed.rrr);
  const [timeFormat, setTimeFormat] = useState<TimeFormatMode>("24h");
  const [startTime, setStartTime] = useState(splitRange(seed.timeRange).start);
  const [endTime, setEndTime] = useState(splitRange(seed.timeRange).end);
  const [entryTf, setEntryTf] = useState(seed.entryTf);
  const [remarks, setRemarks] = useState(seed.remarks);
  const [notionUrl, setNotionUrl] = useState(seed.notionUrl);

  const reset = useCallback(() => {
    setTradeDate(seed.tradeDate); setSession(seed.session); setTimeframeEof(seed.timeframeEof); setPoi(seed.poi);
    setTrend(seed.trend); setPosition(seed.position); setRiskType(seed.riskType); setResult(seed.result);
    setRrr(seed.rrr); setTimeFormat("24h"); const t = splitRange(seed.timeRange); setStartTime(t.start); setEndTime(t.end);
    setEntryTf(seed.entryTf); setRemarks(seed.remarks); setNotionUrl(seed.notionUrl);
  }, [seed]);

  useEffect(() => { if (open) reset(); }, [open, reset]);
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [open, onClose]);
  if (!open) return null;

  const payload: CreateEodRowInput = { tradeDate, session, timeframeEof, poi, trend, position, riskType, result, rrr, timeRange: startTime && endTime ? `${startTime}-${endTime}` : startTime || endTime || "", entryTf, remarks, notionUrl };
  const submit = () => {
    if (mode === "edit" && onSubmit) return onSubmit(payload);
    startTransition(async () => {
      const res = await createEodTrackerRowWithData(payload);
      if ("error" in res) return window.alert(res.error);
      onClose(); reset(); router.refresh();
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-eod-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-[101] flex max-h-[min(calc(100dvh-1.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)),44rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-700 bg-zinc-950 shadow-2xl sm:max-h-[min(92vh,44rem)] sm:rounded-2xl">
        <div className="border-b border-zinc-800 px-4 py-3 text-center">
          <h2 id="add-eod-title" className="text-sm font-semibold text-zinc-100">{mode === "edit" ? "Edit EOD" : "Add new EOD"}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Fill in each column. Options match your tracker presets.</p>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-center">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Date</span>
            <input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              className="eod-modal-date min-h-11 w-full touch-manipulation rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <SingleTagPicker label="Session" fieldKey="session" options={EOD_SESSION_OPTIONS} value={session} onChange={setSession} />
          <MultiTagPicker label="Timeframe EOF" fieldKey="timeframeEof" options={EOD_TIMEFRAME_EOF_OPTIONS} values={timeframeEof} onChange={setTimeframeEof} />
          <MultiTagPicker label="Point of Interest" fieldKey="poi" options={EOD_POI_OPTIONS} values={poi} onChange={setPoi} />
          <SingleTagPicker label="Trend" fieldKey="trend" options={EOD_TREND_OPTIONS} value={trend} onChange={setTrend} />
          <SingleTagPicker label="Position" fieldKey="position" options={EOD_POSITION_OPTIONS} value={position} onChange={setPosition} />
          <SingleTagPicker label="Risk Type" fieldKey="riskType" options={EOD_RISK_TYPE_OPTIONS} value={riskType} onChange={setRiskType} />
          <MultiTagPicker label="Result" fieldKey="result" options={EOD_RESULT_OPTIONS} values={result} onChange={setResult} />
          <SingleTagPicker label="RRR" fieldKey="rrr" options={EOD_RRR_OPTIONS} value={rrr} onChange={setRrr} />
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Time</span>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setTimeFormat("12h")}
                className={`min-h-10 min-w-[3rem] touch-manipulation rounded-md px-3 py-2 text-xs font-medium sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-1 ${timeFormat === "12h" ? "bg-amber-500 text-amber-950" : "bg-zinc-800 text-zinc-300"}`}
              >
                12h
              </button>
              <button
                type="button"
                onClick={() => setTimeFormat("24h")}
                className={`min-h-10 min-w-[3rem] touch-manipulation rounded-md px-3 py-2 text-xs font-medium sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-1 ${timeFormat === "24h" ? "bg-amber-500 text-amber-950" : "bg-zinc-800 text-zinc-300"}`}
              >
                24h
              </button>
            </div>
            {timeFormat === "24h" ? (
              <div className="mx-auto grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {(["start", "end"] as const).map((slot) => {
                  const v = slot === "start" ? startTime : endTime;
                  const { hh, mm } = parse24Parts(v);
                  const setParts = (nextH: string, nextM: string) => {
                    const cv = to24HourString(nextH, nextM);
                    if (slot === "start") setStartTime(cv);
                    else setEndTime(cv);
                  };
                  return (
                    <div key={slot} className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-center">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
                        {slot === "start" ? "Start (24h)" : "End (24h)"}
                      </p>
                      <div className="mx-auto grid max-w-[12rem] grid-cols-2 gap-1">
                        <select
                          value={hh}
                          onChange={(e) => setParts(e.target.value, mm)}
                          className="min-h-10 touch-manipulation rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-center text-xs text-zinc-100 sm:min-h-0"
                          aria-label={slot === "start" ? "Start hour (24h)" : "End hour (24h)"}
                        >
                          {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        <select
                          value={MINUTES_24H.includes(mm) ? mm : "00"}
                          onChange={(e) => setParts(hh, e.target.value)}
                          className="min-h-10 touch-manipulation rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-center text-xs text-zinc-100 sm:min-h-0"
                          aria-label={slot === "start" ? "Start minutes" : "End minutes"}
                        >
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
                  const setV = (next: { hh?: string; mm?: string; period?: "AM" | "PM" }) => {
                    const cv = to24h(next.hh ?? p.hh, next.mm ?? p.mm, next.period ?? p.period);
                    if (slot === "start") setStartTime(cv); else setEndTime(cv);
                  };
                  return (
                    <div key={slot} className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-center">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">{slot === "start" ? "Start" : "End"}</p>
                      <div className="grid grid-cols-3 gap-1">
                        <select value={p.hh} onChange={(e) => setV({ hh: e.target.value })} className="min-h-10 touch-manipulation rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-center text-xs text-zinc-100 sm:min-h-0">{Array.from({ length: 12 }).map((_, i) => { const h = String(i + 1).padStart(2, "0"); return <option key={h} value={h}>{h}</option>; })}</select>
                        <select value={p.mm} onChange={(e) => setV({ mm: e.target.value })} className="min-h-10 touch-manipulation rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-center text-xs text-zinc-100 sm:min-h-0">{MINUTE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                        <select value={p.period} onChange={(e) => setV({ period: e.target.value as "AM" | "PM" })} className="min-h-10 touch-manipulation rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-center text-xs text-zinc-100 sm:min-h-0"><option value="AM">AM</option><option value="PM">PM</option></select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </label>
          <SingleTagPicker label="Entry TF" fieldKey="entryTf" options={EOD_ENTRY_TF_OPTIONS} value={entryTf} onChange={setEntryTf} />
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Remarks</span>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className="min-h-[5.5rem] w-full touch-manipulation resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-sm text-zinc-100" />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Notion link</span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://www.notion.so/..."
              value={notionUrl}
              onChange={(e) => setNotionUrl(e.target.value)}
              className="min-h-11 w-full touch-manipulation rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            <span className="block text-[11px] text-zinc-600">Optional. Opens in a new tab from the EOD table.</span>
          </label>
        </div>
        <div className="flex justify-stretch gap-2 border-t border-zinc-800 px-4 py-3 sm:justify-center">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 touch-manipulation rounded-lg px-3 py-2.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 sm:min-h-0 sm:flex-none sm:py-2"
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
