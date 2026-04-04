"use client";

import { useState, useTransition } from "react";
import {
  deleteEodTrackerRow,
  type CreateEodRowInput,
} from "@/app/actions/eod-tracker-rows";
import { EditEodModal } from "@/components/eod/edit-eod-modal";

export function EodRowManageActions({
  rowId,
  initial,
}: {
  rowId: string;
  initial: CreateEodRowInput;
}) {
  const [open, setOpen] = useState(false);
  const [pendingDelete, startDelete] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 min-w-[2.75rem] touch-manipulation items-center justify-center rounded border border-zinc-300 px-2 py-1.5 text-[10px] text-zinc-800 hover:bg-zinc-100 sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-0.5 sm:text-xs dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Edit
      </button>
      <button
        type="button"
        disabled={pendingDelete}
        onClick={() => {
          if (!window.confirm("Delete this EOD row?")) return;
          startDelete(async () => {
            const res = await deleteEodTrackerRow(rowId);
            if ("error" in res) {
              window.alert(res.error);
              return;
            }
            window.location.reload();
          });
        }}
        className="inline-flex min-h-9 min-w-[2.75rem] touch-manipulation items-center justify-center rounded border border-red-300 px-2 py-1.5 text-[10px] text-red-700 hover:bg-red-50 disabled:opacity-50 sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-0.5 sm:text-xs dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
      >
        Delete
      </button>
      <EditEodModal
        open={open}
        onClose={() => setOpen(false)}
        initial={{ rowId, ...initial }}
        onSaved={() => window.location.reload()}
      />
    </div>
  );
}

