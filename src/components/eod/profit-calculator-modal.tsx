"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentUsdToPhpRate } from "@/app/actions/fx-rate";

export type ProfitCalculatorModalProps = {
  open: boolean;
  onClose: () => void;
};

const ACCOUNTS = [
  { label: "$5,000", value: 5000 },
  { label: "$10,000", value: 10000 },
  { label: "$25,000", value: 25000 },
  { label: "$50,000", value: 50000 },
  { label: "$100,000", value: 100000 },
  { label: "$200,000", value: 200000 },
] as const;

/** Matches the Python calculator's fallback when the live rate can't be fetched. */
const FALLBACK_USD_PHP = 60;

function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function php(n: number): string {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}

export function ProfitCalculatorModal({ open, onClose }: ProfitCalculatorModalProps) {
  const [accountValue, setAccountValue] = useState<number>(ACCOUNTS[0].value);
  const [riskReward, setRiskReward] = useState(60);
  const [riskPercent, setRiskPercent] = useState(0.5);
  const [profitSplit, setProfitSplit] = useState(80);
  const [usdToPhp, setUsdToPhp] = useState(FALLBACK_USD_PHP);
  const [rateLoaded, setRateLoaded] = useState(false);

  useEffect(() => {
    if (!open || rateLoaded) return;
    let cancelled = false;
    getCurrentUsdToPhpRate()
      .then((rate) => {
        if (!cancelled && Number.isFinite(rate) && rate > 0) setUsdToPhp(rate);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRateLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, rateLoaded]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  const { profitPercent, grossProfit, takeHome, phpValue } = useMemo(() => {
    const profitPercentCalc = riskReward * riskPercent;
    const grossProfitCalc = accountValue * (profitPercentCalc / 100);
    const takeHomeCalc = grossProfitCalc * (profitSplit / 100);
    const phpValueCalc = takeHomeCalc * usdToPhp;
    return {
      profitPercent: profitPercentCalc,
      grossProfit: grossProfitCalc,
      takeHome: takeHomeCalc,
      phpValue: phpValueCalc,
    };
  }, [accountValue, riskReward, riskPercent, profitSplit, usdToPhp]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))] dark:bg-black/70 sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profit-calc-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-[101] flex max-h-[min(calc(100dvh-1.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)),44rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950 sm:max-h-[min(92vh,44rem)] sm:rounded-2xl">
        <div className="border-b border-zinc-200 px-4 py-3 text-center dark:border-zinc-800">
          <h2 id="profit-calc-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            MIDAS Prop Firm Profit Calculator
          </h2>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-500">
            Automatically uses the latest USD → PHP exchange rate.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-center">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Funded Account
            </span>
            <select
              value={accountValue}
              onChange={(e) => setAccountValue(Number(e.target.value))}
              className="min-h-11 w-full touch-manipulation rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {ACCOUNTS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Risk Reward (R)
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={riskReward}
              onChange={(e) => setRiskReward(Math.max(0, Number(e.target.value) || 0))}
              className="min-h-11 w-full touch-manipulation rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Risk Per Trade (%)
            </span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={riskPercent}
              onChange={(e) => setRiskPercent(Math.max(0, Number(e.target.value) || 0))}
              className="min-h-11 w-full touch-manipulation rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>

          <label className="block space-y-2">
            <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              <span>Profit Split</span>
              <span className="font-mono normal-case text-zinc-800 dark:text-zinc-200">{profitSplit}%</span>
            </span>
            <input
              type="range"
              min={50}
              max={100}
              step={1}
              value={profitSplit}
              onChange={(e) => setProfitSplit(Number(e.target.value))}
              className="w-full touch-manipulation accent-amber-500"
            />
          </label>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Profit %" value={`${profitPercent.toFixed(2)}%`} />
              <Metric label="Gross Profit" value={usd(grossProfit)} />
              <Metric label="After Profit Split" value={usd(takeHome)} />
              <Metric label="PHP Value" value={php(phpValue)} />
            </div>
          </div>

          <div className="text-left">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
              Calculation
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-900 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-zinc-100 dark:border-zinc-800">
{`${riskReward}R × ${riskPercent}% Risk = ${profitPercent.toFixed(2)}%

${profitPercent.toFixed(2)}% × ${usd(accountValue)}
= ${usd(grossProfit)}

${usd(grossProfit)} × ${profitSplit}% Profit Split
= ${usd(takeHome)}

${usd(takeHome)} × ${usdToPhp.toFixed(2)}
= ${php(phpValue)}`}
            </pre>
          </div>

          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
            Current USD/PHP Rate: {usdToPhp.toFixed(4)}
            {!rateLoaded ? " (loading…)" : ""}
          </p>
        </div>

        <div className="flex justify-stretch gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:justify-center">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 touch-manipulation rounded-lg bg-amber-500 px-3 py-2.5 text-xs font-semibold text-amber-950 hover:bg-amber-400 sm:min-h-0 sm:flex-none sm:py-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
