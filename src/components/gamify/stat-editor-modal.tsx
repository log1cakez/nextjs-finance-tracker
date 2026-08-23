"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { GamifyStatSummary } from "@/app/actions/gamify-dashboard";
import {
  createGamifyStat,
  deleteGamifyStat,
  updateGamifyStat,
  type GamifyStatActionState,
} from "@/app/actions/gamify-stats";
import { useCenterToast, useToastOnActionError } from "@/components/center-toast";
import { GamifyConfirmDialog } from "@/components/gamify/gamify-confirm-dialog";
import { useGamifySound } from "@/components/gamify/gamify-sound-provider";
import { RetroModal } from "@/components/gamify/retro-modal";

const PALETTE = ["#4deaff", "#ff5cd6", "#ffe14d", "#52ff9d", "#ff6b6b", "#a78bfa", "#fb923c", "#f8fafc"];

const initial: GamifyStatActionState = {};

export function StatEditorModal({
  initialStat,
  onClose,
}: {
  initialStat: GamifyStatSummary | null;
  onClose: () => void;
}) {
  const action = initialStat ? updateGamifyStat : createGamifyStat;
  const [state, formAction, pending] = useActionState(action, initial);
  const { showToast } = useCenterToast();
  useToastOnActionError(state.error, pending, "Could not save stat");
  const { play } = useGamifySound();
  const [color, setColor] = useState(initialStat?.color ?? PALETTE[0]);
  const [isDeleting, startDelete] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (state.success) {
      play("save");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  function performDelete() {
    if (!initialStat) return;
    startDelete(async () => {
      const fd = new FormData();
      fd.set("id", initialStat.id);
      const res = await deleteGamifyStat(initial, fd);
      if (res.error) {
        showToast({ kind: "error", title: "Could not delete stat", message: res.error, timeoutMs: 5200 });
        return;
      }
      play("delete");
      onClose();
    });
  }

  return (
    <RetroModal title={initialStat ? "EDIT STAT" : "NEW STAT"} onClose={onClose}>
      <form action={formAction} className="space-y-4">
        {initialStat ? <input type="hidden" name="id" value={initialStat.id} /> : null}
        <input type="hidden" name="color" value={color} />
        <label className="block text-xs text-[var(--gb-dim)]">
          Name
          <input
            name="name"
            required
            maxLength={40}
            defaultValue={initialStat?.name ?? ""}
            placeholder="Strength, Wisdom, Trading…"
            className="mt-1.5 w-full border-2 border-[var(--gb-border)] bg-[var(--gb-panel-alt)] px-3 py-2 text-sm text-[var(--gb-text)] outline-none focus:border-[var(--gb-cyan)]"
          />
        </label>
        <label className="block text-xs text-[var(--gb-dim)]">
          Icon (emoji)
          <input
            name="icon"
            maxLength={8}
            defaultValue={initialStat?.icon ?? ""}
            placeholder="💪"
            className="mt-1.5 w-24 border-2 border-[var(--gb-border)] bg-[var(--gb-panel-alt)] px-3 py-2 text-sm text-[var(--gb-text)] outline-none focus:border-[var(--gb-cyan)]"
          />
        </label>
        <div>
          <span className="block text-xs text-[var(--gb-dim)]">Color</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                className="h-8 w-8 border-2"
                style={{
                  backgroundColor: c,
                  borderColor: c === color ? "var(--gb-text)" : "transparent",
                  boxShadow: c === color ? "0 0 0 2px var(--gb-panel), 0 0 0 4px var(--gb-text)" : "none",
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          {initialStat ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={isDeleting}
              className="pixel-btn pixel-corners-sm px-3 py-2 text-[10px] text-[var(--gb-magenta)]"
            >
              {isDeleting ? "..." : "DELETE"}
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={pending}
            className="pixel-font pixel-btn pixel-corners-sm px-4 py-2 text-[10px] text-[var(--gb-green)]"
          >
            {pending ? "..." : "SAVE"}
          </button>
        </div>
      </form>
      {confirmingDelete && initialStat ? (
        <GamifyConfirmDialog
          title="DELETE STAT"
          message={`Delete "${initialStat.name}"? Quests using it must be reassigned first.`}
          onConfirm={() => {
            setConfirmingDelete(false);
            performDelete();
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}
    </RetroModal>
  );
}
