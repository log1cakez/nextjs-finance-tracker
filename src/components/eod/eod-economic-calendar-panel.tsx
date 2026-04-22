"use client";

import { useCallback, useEffect, useState } from "react";

type EconomicCalendarRow = {
  id: string;
  date: string;
  country: string;
  currency: string;
  symbol: string;
  category: string;
  event: string;
  actual: string;
  previous: string;
  forecast: string;
  importance: number;
  url: string;
};

const EOD_DISPLAY_LOCALE = "en-US";

function importanceLabel(level: number): string {
  if (level >= 3) return "High";
  if (level >= 2) return "Medium";
  if (level >= 1) return "Low";
  return "—";
}

function impactDots(level: number): string {
  const n = Math.max(1, Math.min(3, level || 1));
  return "●".repeat(n);
}

function inferCurrencyCode(row: EconomicCalendarRow): string {
  const c = row.currency.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) return c;
  const s = row.symbol.trim().toUpperCase();
  if (/^[A-Z]{3,6}$/.test(s)) return s.slice(0, 3);
  const fallback = row.country.replace(/[^A-Za-z]/g, "").toUpperCase();
  return fallback.slice(0, 3) || "—";
}

export function EodEconomicCalendarPanel({
  configured,
  defaultImportance = "3",
}: {
  configured: boolean;
  defaultImportance?: "1" | "2" | "3";
}) {
  const [rows, setRows] = useState<EconomicCalendarRow[]>([]);
  const [importance, setImportance] = useState<"1" | "2" | "3">(defaultImportance);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/eod/economic-calendar?importance=${importance}&limit=25`,
        { credentials: "include" },
      );
      const data = (await res.json()) as {
        error?: string;
        detail?: string;
        fetchedAt?: string;
        events?: EconomicCalendarRow[];
      };
      if (!res.ok) {
        setRows([]);
        setError(
          data.detail ? `${data.error ?? "Could not load events"}: ${data.detail}` : data.error ?? "Could not load events",
        );
        return;
      }
      setRows(Array.isArray(data.events) ? data.events : []);
      setFetchedAt(typeof data.fetchedAt === "string" ? data.fetchedAt : null);
    } catch {
      setRows([]);
      setError("Could not load economic calendar events.");
    } finally {
      setLoading(false);
    }
  }, [configured, importance]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-zinc-500 dark:text-zinc-500">
            Economic calendar
          </p>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Upcoming high-impact events
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-600 dark:text-zinc-400">
            Importance
            <select
              value={importance}
              onChange={(e) => setImportance(e.target.value as "1" | "2" | "3")}
              className="ml-2 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="3">High</option>
              <option value="2">Medium+</option>
              <option value="1">All</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={!configured || loading}
            className="rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {!configured ? (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Add <code>TRADING_ECONOMICS_API_KEY</code> to server env to enable this panel.
        </p>
      ) : error ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">No events available right now.</p>
      ) : (
        <>
          <ul className="space-y-2 lg:hidden">
            {rows.map((row) => (
              <li key={`${row.id}-${row.date}`} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  {new Date(row.date).toLocaleString(EOD_DISPLAY_LOCALE, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {inferCurrencyCode(row)} · {impactDots(row.importance)} {importanceLabel(row.importance)}
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.event}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{row.category || "—"}</p>
                <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">
                  A: {row.actual || "—"} · F: {row.forecast || "—"} · P: {row.previous || "—"}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:block">
            <table className="w-full min-w-[56rem] text-left text-xs">
              <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Cur.</th>
                  <th className="px-3 py-2">Impact</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Actual</th>
                  <th className="px-3 py-2">Forecast</th>
                  <th className="px-3 py-2">Previous</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.id}-${row.date}`} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700 dark:text-zinc-300">
                      {new Date(row.date).toLocaleString(EOD_DISPLAY_LOCALE, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2 font-medium">{inferCurrencyCode(row)}</td>
                    <td className="px-3 py-2">
                      <span title={importanceLabel(row.importance)} className="text-amber-600 dark:text-amber-400">
                        {impactDots(row.importance)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.event || "—"}
                      <span className="ml-2 text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                        {row.country || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.actual || "—"}</td>
                    <td className="px-3 py-2">{row.forecast || "—"}</td>
                    <td className="px-3 py-2">{row.previous || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fetchedAt ? (
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Last sync:{" "}
              {new Date(fetchedAt).toLocaleString(EOD_DISPLAY_LOCALE, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
