"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { EOD_AI_PROD_MAX_RUNS_PER_JOURNAL_STAMP } from "@/lib/eod-ai-prod-quota";

function formatYearMonthHeading(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function renderAiMarkdownLight(text: string): ReactNode {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const boldParts = line.split(/\*\*(.+?)\*\*/g);
        const parts: ReactNode[] = [];
        for (let j = 0; j < boldParts.length; j++) {
          if (j % 2 === 1) {
            parts.push(
              <strong key={j} className="font-semibold text-zinc-900 dark:text-zinc-100">
                {boldParts[j]}
              </strong>,
            );
          } else if (boldParts[j]) {
            parts.push(<span key={j}>{boldParts[j]}</span>);
          }
        }
        return (
          <p
            key={i}
            className="mb-3 text-sm leading-relaxed text-zinc-700 last:mb-0 dark:text-zinc-300"
          >
            {parts.length > 0 ? parts : "\u00a0"}
          </p>
        );
      })}
    </>
  );
}

export function EodAiAnalyticsPanel({
  month,
  journalDataStamp,
  openAiConfigured,
  summarizeUnrestricted,
}: {
  /** Calendar month `YYYY-MM` (from journal month picker). */
  month: string;
  /** Live stamp of journal rows in `month` (sorted id:updatedAt); must match server algorithm. */
  journalDataStamp: string;
  openAiConfigured: boolean;
  /** When true (MIDAS_RUNTIME_MODE=dev), summarize is allowed any day. */
  summarizeUnrestricted: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [persistWarning, setPersistWarning] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ periodLabel: string; tradeCount: number } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [sourceJournalStamp, setSourceJournalStamp] = useState<string | null>(null);
  const [summarizeRunCount, setSummarizeRunCount] = useState(0);

  const canSubmit = useMemo(() => /^\d{4}-\d{2}$/.test(month), [month]);

  /** Production: hit 3 saved runs for this journal snapshot (same month + stamp). */
  const prodQuotaExhausted = useMemo(() => {
    if (summarizeUnrestricted) return false;
    if (sourceJournalStamp == null || sourceJournalStamp === "") return false;
    if (sourceJournalStamp !== journalDataStamp) return false;
    return summarizeRunCount >= EOD_AI_PROD_MAX_RUNS_PER_JOURNAL_STAMP;
  }, [
    summarizeUnrestricted,
    sourceJournalStamp,
    journalDataStamp,
    summarizeRunCount,
  ]);

  const canClickSummarize = useMemo(() => {
    if (!openAiConfigured || !canSubmit || loading) return false;
    if (summarizeUnrestricted) return true;
    if (prodQuotaExhausted) return false;
    return true;
  }, [openAiConfigured, canSubmit, loading, summarizeUnrestricted, prodQuotaExhausted]);

  useEffect(() => {
    let cancelled = false;
    setLoadingSaved(true);
    setLoadError(null);
    setPostError(null);
    setPersistWarning(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/eod/ai-summary?month=${encodeURIComponent(month)}`,
          { credentials: "include" },
        );
        const data = (await res.json()) as {
          error?: string;
          summary: {
            summaryText: string;
            tradeCount: number;
            periodLabel: string;
            updatedAt: string;
            sourceJournalStamp: string | null;
            summarizeRunCount: number;
          } | null;
        };
        if (cancelled) return;
        if (!res.ok) {
          setText(null);
          setMeta(null);
          setSavedAt(null);
          setSourceJournalStamp(null);
          setSummarizeRunCount(0);
          setLoadError(data.error ?? "Could not load saved summary.");
          return;
        }
        if (data.summary) {
          setText(data.summary.summaryText);
          setMeta({
            periodLabel: data.summary.periodLabel,
            tradeCount: data.summary.tradeCount,
          });
          setSavedAt(data.summary.updatedAt);
          setSourceJournalStamp(data.summary.sourceJournalStamp ?? null);
          setSummarizeRunCount(
            typeof data.summary.summarizeRunCount === "number"
              ? data.summary.summarizeRunCount
              : 0,
          );
        } else {
          setText(null);
          setMeta(null);
          setSavedAt(null);
          setSourceJournalStamp(null);
          setSummarizeRunCount(0);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Could not load saved summary.");
        }
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month]);

  const run = useCallback(async () => {
    if (!canClickSummarize) return;
    setLoading(true);
    setPostError(null);
    setPersistWarning(null);
    try {
      const res = await fetch("/api/eod/analytics-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
        credentials: "include",
      });
      const data = (await res.json()) as {
        error?: string;
        detail?: string;
        text?: string;
        periodLabel?: string;
        tradeCount?: number;
        journalDataStamp?: string;
        summarizeRunCount?: number | null;
        savedAt?: string | null;
        persisted?: boolean;
        persistWarning?: string;
      };
      if (!res.ok) {
        setPostError(
          data.detail ? `${data.error ?? "Request failed"}: ${data.detail}` : data.error ?? "Request failed",
        );
        return;
      }
      if (typeof data.text === "string") {
        setText(data.text);
        if (data.periodLabel != null && typeof data.tradeCount === "number") {
          setMeta({ periodLabel: data.periodLabel, tradeCount: data.tradeCount });
        }
        setSavedAt(typeof data.savedAt === "string" ? data.savedAt : null);
        if (data.persisted === true && typeof data.journalDataStamp === "string") {
          setSourceJournalStamp(data.journalDataStamp);
        }
        if (data.persisted === true && typeof data.summarizeRunCount === "number") {
          setSummarizeRunCount(data.summarizeRunCount);
        }
        if (data.persisted === false && data.persistWarning) {
          setPersistWarning(data.persistWarning);
        }
      } else {
        setPostError("Unexpected response.");
      }
    } catch {
      setPostError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }, [canClickSummarize, month]);

  const summarizeTitle = !openAiConfigured
    ? "Configure OPENAI_API_KEY on the server"
    : !summarizeUnrestricted && prodQuotaExhausted
      ? `Production allows up to ${EOD_AI_PROD_MAX_RUNS_PER_JOURNAL_STAMP} summaries while this month's journal rows are unchanged. Edit the table to run again.`
      : undefined;

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90 sm:p-5"
      aria-labelledby="eod-ai-analytics-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            id="eod-ai-analytics-heading"
            className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            AI month review
          </h2>
          <p className="mt-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            {formatYearMonthHeading(month)}
          </p>
          <p className="mt-1 max-w-xl text-xs text-zinc-600 dark:text-zinc-500">
            Summarizes how your logged sessions look for the journal month you selected above—patterns,
            strengths, and one focus for next month. Uses your EOD fields only (not live market data).
            Saved summaries are kept per month.
          </p>
          {!openAiConfigured ? (
            <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">
              Set{" "}
              <code className="rounded bg-zinc-200/90 px-1 py-0.5 font-mono text-[10px] dark:bg-zinc-800/80">
                OPENAI_API_KEY
              </code>{" "}
              on the server to generate summaries. You can still open past months to read anything
              already saved.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => void run()}
            disabled={!canClickSummarize}
            title={summarizeTitle}
            className="inline-flex h-10 min-h-10 shrink-0 touch-manipulation items-center justify-center rounded-lg bg-amber-500/90 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Generating…" : "Summarize with AI"}
          </button>
        </div>
      </div>

      {loadingSaved ? (
        <p className="mt-3 text-[11px] text-zinc-600 dark:text-zinc-500">Loading saved summary…</p>
      ) : null}

      {loadError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {loadError}
        </p>
      ) : null}

      {postError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {postError}
        </p>
      ) : null}

      {persistWarning ? (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {persistWarning}
        </p>
      ) : null}

      {meta && text ? (
        <p className="mt-3 text-[11px] text-zinc-600 dark:text-zinc-500">
          {meta.periodLabel} · {meta.tradeCount} journal {meta.tradeCount === 1 ? "entry" : "entries"}{" "}
          in range
          {savedAt ? (
            <>
              {" "}
              · saved{" "}
              {new Date(savedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </>
          ) : null}
          {!summarizeUnrestricted &&
          sourceJournalStamp != null &&
          sourceJournalStamp === journalDataStamp &&
          summarizeRunCount > 0 ? (
            <>
              {" "}
              · production runs for this journal: {summarizeRunCount}/
              {EOD_AI_PROD_MAX_RUNS_PER_JOURNAL_STAMP}
            </>
          ) : null}
        </p>
      ) : null}

      {text ? (
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800/80">
          <div className="prose-eod-ai max-w-none">{renderAiMarkdownLight(text)}</div>
          <p className="mt-4 text-[10px] leading-snug text-zinc-600 dark:text-zinc-500">
            AI output is for reflection only—not financial advice. Verify against your own notes and
            rules.
          </p>
        </div>
      ) : !loadingSaved && !loadError ? (
        <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-500">
          No saved summary for this month yet.
        </p>
      ) : null}
    </section>
  );
}
