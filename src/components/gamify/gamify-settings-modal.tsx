"use client";

import { useActionState, useEffect } from "react";
import { updateGamifyXpMode, type GamifyProfileActionState } from "@/app/actions/gamify-profile";
import { useCenterToast, useToastOnActionError } from "@/components/center-toast";
import { useGamifySound } from "@/components/gamify/gamify-sound-provider";
import { RetroModal } from "@/components/gamify/retro-modal";
import type { GamifyXpMode } from "@/lib/gamify-xp";

const initial: GamifyProfileActionState = {};

const MODE_LABELS: Record<GamifyXpMode, string> = { auto: "AUTO", manual: "MANUAL" };
const MODE_DESCRIPTIONS: Record<GamifyXpMode, string> = {
  auto: "New quests suggest XP that scales with your character level, so rewards stay meaningful as you grow.",
  manual: "New quests always suggest the same fixed XP (10 daily / 50 weekly / 200 monthly) — you set the rest.",
};

export function GamifySettingsModal({ xpMode, onClose }: { xpMode: GamifyXpMode; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(updateGamifyXpMode, initial);
  const { showToast } = useCenterToast();
  useToastOnActionError(state.error, pending, "Could not update setting");
  const { play } = useGamifySound();

  useEffect(() => {
    if (state.success) {
      play("save");
      showToast({ kind: "success", title: "Settings updated", timeoutMs: 1600 });
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <RetroModal title="SETTINGS" onClose={onClose}>
      <form action={formAction} className="space-y-3">
        <p className="pixel-font text-[10px] text-[var(--gb-yellow)]">NEW QUEST XP</p>
        <div className="flex gap-2">
          {(Object.keys(MODE_LABELS) as GamifyXpMode[]).map((mode) => (
            <button
              key={mode}
              type="submit"
              name="xpMode"
              value={mode}
              disabled={pending}
              className="pixel-font pixel-corners-sm flex-1 border-2 px-3 py-2 text-[10px]"
              style={
                xpMode === mode
                  ? { borderColor: "var(--gb-cyan)", background: "var(--gb-cyan)", color: "var(--gb-bg)" }
                  : { borderColor: "var(--gb-border)", background: "var(--gb-panel-alt)", color: "var(--gb-dim)" }
              }
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-[var(--gb-dim)]">{MODE_DESCRIPTIONS[xpMode]}</p>
      </form>
    </RetroModal>
  );
}
