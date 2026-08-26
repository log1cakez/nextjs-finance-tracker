"use client";

import { useState } from "react";
import { ProfitCalculatorModal } from "@/components/eod/profit-calculator-modal";

export function ProfitCalculatorLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full min-h-11 touch-manipulation items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 sm:w-auto sm:min-h-10 sm:px-3 sm:py-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        💰 Profit Calculator
      </button>
      <ProfitCalculatorModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
