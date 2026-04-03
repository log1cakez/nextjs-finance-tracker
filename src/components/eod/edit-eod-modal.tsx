"use client";

import { useTransition } from "react";
import {
  type CreateEodRowInput,
  updateEodTrackerRowWithData,
} from "@/app/actions/eod-tracker-rows";
import { AddEodModal } from "@/components/eod/add-eod-modal";

export type EodEditInitial = CreateEodRowInput & { rowId: string };

export function EditEodModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: EodEditInitial;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <AddEodModal
      open={open}
      onClose={onClose}
      mode="edit"
      initialData={initial}
      pending={pending}
      onSubmit={(next) =>
        startTransition(async () => {
          const res = await updateEodTrackerRowWithData(initial.rowId, next);
          if ("error" in res) {
            window.alert(res.error);
            return;
          }
          onSaved();
          onClose();
        })
      }
    />
  );
}

