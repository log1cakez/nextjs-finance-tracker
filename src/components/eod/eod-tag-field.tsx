"use client";

import type { EodPillTone } from "@/lib/eod-tracker-options";
import { eodPillClass, getEodOptionTone } from "@/lib/eod-tracker-options";

function SingleTagPicker({
  label,
  fieldKey,
  options,
  value,
  onChange,
}: {
  label: string;
  fieldKey: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
        {label}
      </p>
      <p className="text-xs text-zinc-600 dark:text-zinc-500">Select an option or clear.</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {options.map((opt) => {
          const tone = getEodOptionTone(fieldKey, opt) as EodPillTone;
          const on = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(on ? "" : opt)}
              className={`min-h-9 touch-manipulation rounded-lg border px-2.5 py-1.5 text-xs font-medium transition sm:min-h-0 sm:py-1 ${
                on
                  ? `${eodPillClass(tone)} ring-2 ring-amber-500/60`
                  : "border-zinc-300 bg-zinc-100/80 text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiTagPicker({
  label,
  fieldKey,
  options,
  values,
  onChange,
}: {
  label: string;
  fieldKey: string;
  options: readonly string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (values.includes(opt)) {
      onChange(values.filter((x) => x !== opt));
    } else {
      onChange([...values, opt]);
    }
  };

  return (
    <div className="space-y-2 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
        {label}
      </p>
      <p className="text-xs text-zinc-600 dark:text-zinc-500">Select one or more options.</p>
      <div className="flex flex-wrap justify-center gap-1">
        {values.map((v) => {
          const tone = getEodOptionTone(fieldKey, v) as EodPillTone;
          return (
            <button
              key={v}
              type="button"
              onClick={() => toggle(v)}
              className={`${eodPillClass(tone)} min-h-9 touch-manipulation gap-1 py-1.5 text-xs font-medium sm:min-h-0 sm:py-1`}
            >
              {v}
              <span aria-hidden className="opacity-70">
                ×
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {options.map((opt) => {
          const tone = getEodOptionTone(fieldKey, opt) as EodPillTone;
          const on = values.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`min-h-9 touch-manipulation rounded-lg border px-2.5 py-1.5 text-xs font-medium transition sm:min-h-0 sm:py-1 ${
                on
                  ? `${eodPillClass(tone)} ring-2 ring-amber-500/60`
                  : "border-zinc-300 bg-zinc-100/80 text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { MultiTagPicker, SingleTagPicker };
