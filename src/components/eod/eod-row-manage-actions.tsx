"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteEodTrackerRow,
  type CreateEodRowInput,
} from "@/app/actions/eod-tracker-rows";
import type { EodTradingAccount } from "@/app/actions/eod-trading-accounts";
import { useCenterToast } from "@/components/center-toast";
import { EditEodModal } from "@/components/eod/edit-eod-modal";

export function EodRowManageActions({
  rowId,
  initial,
  tradingAccounts,
}: {
  rowId: string;
  initial: CreateEodRowInput;
  tradingAccounts: EodTradingAccount[];
}) {
  const router = useRouter();
  const { showToast } = useCenterToast();
  const [open, setOpen] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [pendingDelete, startDelete] = useTransition();

  const runDelete = () => {
    startDelete(async () => {
      const res = await deleteEodTrackerRow(rowId);
      if ("error" in res) {
        showToast({
          kind: "error",
          title: "Could not delete row",
          message: res.error,
          timeoutMs: 6500,
        });
        setDeleteArmed(false);
        return;
      }
      setDeleteArmed(false);
      showToast({ kind: "success", title: "Journal row deleted", timeoutMs: 2200 });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setDeleteArmed(false);
          setOpen(true);
        }}
        className="inline-flex min-h-9 min-w-[2.75rem] touch-manipulation items-center justify-center rounded border border-zinc-300 px-2 py-1.5 text-[10px] text-zinc-800 hover:bg-zinc-100 sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-0.5 sm:text-xs dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Edit
      </button>
      {deleteArmed ? (
        <span className="inline-flex flex-wrap items-center justify-center gap-1">
          <button
            type="button"
            disabled={pendingDelete}
            onClick={() => setDeleteArmed(false)}
            className="inline-flex min-h-9 touch-manipulation items-center justify-center rounded border border-zinc-300 px-2 py-1.5 text-[10px] text-zinc-700 hover:bg-zinc-100 sm:min-h-0 sm:py-0.5 sm:text-xs dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pendingDelete}
            onClick={runDelete}
            className="inline-flex min-h-9 touch-manipulation items-center justify-center rounded border border-red-400 bg-red-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-red-500 disabled:opacity-50 sm:min-h-0 sm:py-0.5 sm:text-xs"
          >
            {pendingDelete ? "…" : "Confirm"}
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={pendingDelete}
          onClick={() => setDeleteArmed(true)}
          className="inline-flex min-h-9 min-w-[2.75rem] touch-manipulation items-center justify-center rounded border border-red-300 px-2 py-1.5 text-[10px] text-red-700 hover:bg-red-50 disabled:opacity-50 sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-0.5 sm:text-xs dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Delete
        </button>
      )}
      <EditEodModal
        open={open}
        onClose={() => setOpen(false)}
        initial={{ rowId, ...initial }}
        tradingAccounts={tradingAccounts}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

