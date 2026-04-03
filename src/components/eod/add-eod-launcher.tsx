"use client";

import { useState } from "react";
import { AddEodModal } from "@/components/eod/add-eod-modal";

export function AddEodLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full min-h-11 touch-manipulation items-center justify-center rounded-lg bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-white sm:w-auto sm:min-h-10 sm:px-3 sm:py-2"
      >
        + Add new EOD
      </button>
      <AddEodModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
