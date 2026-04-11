"use client";

import { useTransition } from "react";
import {
  type CreateEodRowInput,
  updateEodTrackerRowWithData,
} from "@/app/actions/eod-tracker-rows";
import type { EodTradingAccount } from "@/app/actions/eod-trading-accounts";
import { useCenterToast } from "@/components/center-toast";
import { AddEodModal } from "@/components/eod/add-eod-modal";

export type EodEditInitial = CreateEodRowInput & { rowId: string };

export function EditEodModal({
  open,
  onClose,
  initial,
  tradingAccounts,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: EodEditInitial;
  tradingAccounts: EodTradingAccount[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const { showToast } = useCenterToast();

  return (
    <AddEodModal
      open={open}
      onClose={onClose}
      mode="edit"
      initialData={initial}
      tradingAccounts={tradingAccounts}
      pending={pending}
      onSubmit={(next) =>
        startTransition(async () => {
          const res = await updateEodTrackerRowWithData(initial.rowId, next);
          if ("error" in res) {
            showToast({
              kind: "error",
              title: "Could not save changes",
              message: res.error,
              timeoutMs: 6500,
            });
            return;
          }
          onSaved();
          onClose();
        })
      }
    />
  );
}

