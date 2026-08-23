"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { GamifyQuestSummary, GamifyStatSummary } from "@/app/actions/gamify-dashboard";
import {
  createGamifyQuest,
  deleteGamifyQuest,
  updateGamifyQuest,
  type GamifyQuestActionState,
} from "@/app/actions/gamify-quests";
import { useCenterToast, useToastOnActionError } from "@/components/center-toast";
import { GamifyConfirmDialog } from "@/components/gamify/gamify-confirm-dialog";
import { useGamifySound } from "@/components/gamify/gamify-sound-provider";
import { RetroModal } from "@/components/gamify/retro-modal";
import { WEEKDAY_LABELS, type QuestCadence, type WeekdayLabel } from "@/lib/gamify-period";
import { suggestedXpForCadence, type GamifyXpMode } from "@/lib/gamify-xp";

const initial: GamifyQuestActionState = {};

const CADENCE_LABELS: Record<QuestCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export function QuestEditorModal({
  initialQuest,
  stats,
  defaultCadence,
  xpMode,
  characterLevel,
  onClose,
}: {
  initialQuest: GamifyQuestSummary | null;
  stats: GamifyStatSummary[];
  defaultCadence: QuestCadence;
  xpMode: GamifyXpMode;
  characterLevel: number;
  onClose: () => void;
}) {
  const action = initialQuest ? updateGamifyQuest : createGamifyQuest;
  const [state, formAction, pending] = useActionState(action, initial);
  const { showToast } = useCenterToast();
  useToastOnActionError(state.error, pending, "Could not save quest");
  const { play } = useGamifySound();
  const [isDeleting, startDelete] = useTransition();
  const [cadence, setCadence] = useState<QuestCadence>(initialQuest?.cadence ?? defaultCadence);
  const [selectedDays, setSelectedDays] = useState<WeekdayLabel[]>(initialQuest?.daysOfWeek ?? []);
  const [xp, setXp] = useState<number>(
    initialQuest?.xp ?? suggestedXpForCadence(xpMode, defaultCadence, characterLevel),
  );
  // Editing an existing quest keeps its saved XP even if you change cadence; a brand-new
  // quest keeps auto-filling XP from the suggested value until you type your own value.
  const [xpTouched, setXpTouched] = useState(Boolean(initialQuest));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function toggleDay(day: WeekdayLabel) {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function handleCadenceChange(next: QuestCadence) {
    setCadence(next);
    if (!xpTouched) {
      setXp(suggestedXpForCadence(xpMode, next, characterLevel));
    }
  }

  useEffect(() => {
    if (state.success) {
      play("save");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  function performDelete() {
    if (!initialQuest) return;
    startDelete(async () => {
      const fd = new FormData();
      fd.set("id", initialQuest.id);
      const res = await deleteGamifyQuest(initial, fd);
      if (res.error) {
        showToast({ kind: "error", title: "Could not delete quest", message: res.error, timeoutMs: 5200 });
        return;
      }
      play("delete");
      onClose();
    });
  }

  return (
    <RetroModal title={initialQuest ? "EDIT QUEST" : "NEW QUEST"} onClose={onClose}>
      {stats.length === 0 ? (
        <p className="text-xs text-[var(--gb-dim)]">Add a stat first, then come back to create a quest.</p>
      ) : (
        <form action={formAction} className="space-y-4">
          {initialQuest ? <input type="hidden" name="id" value={initialQuest.id} /> : null}
          <label className="block text-xs text-[var(--gb-dim)]">
            Title
            <input
              name="title"
              required
              maxLength={120}
              defaultValue={initialQuest?.title ?? ""}
              placeholder="5K Run, Read 20 pages…"
              className="mt-1.5 w-full border-2 border-[var(--gb-border)] bg-[var(--gb-panel-alt)] px-3 py-2 text-sm text-[var(--gb-text)] outline-none focus:border-[var(--gb-cyan)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-[var(--gb-dim)]">
              Stat
              <select
                name="statId"
                required
                defaultValue={initialQuest?.stat.id ?? stats[0]?.id}
                className="mt-1.5 w-full border-2 border-[var(--gb-border)] bg-[var(--gb-panel-alt)] px-3 py-2 text-sm text-[var(--gb-text)] outline-none focus:border-[var(--gb-cyan)]"
              >
                {stats.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-[var(--gb-dim)]">
              XP
              <div className="mt-1.5 flex gap-1.5">
                <input
                  name="xp"
                  type="number"
                  min={1}
                  max={999}
                  required
                  value={xp}
                  onChange={(e) => {
                    setXp(Number(e.target.value));
                    setXpTouched(true);
                  }}
                  className="w-full border-2 border-[var(--gb-border)] bg-[var(--gb-panel-alt)] px-3 py-2 text-sm text-[var(--gb-text)] outline-none focus:border-[var(--gb-cyan)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setXp(suggestedXpForCadence(xpMode, cadence, characterLevel));
                    setXpTouched(false);
                  }}
                  title={xpMode === "auto" ? "Use level-scaled suggestion" : "Use default"}
                  className="pixel-btn pixel-corners-sm shrink-0 px-2 text-[10px]"
                >
                  ↺
                </button>
              </div>
            </label>
          </div>
          <p className="text-[10px] text-[var(--gb-dim)]">
            {xpMode === "auto"
              ? `XP mode: Auto — scales with your level (Lv ${characterLevel})`
              : "XP mode: Manual — fixed defaults"}
          </p>
          <label className="block text-xs text-[var(--gb-dim)]">
            Cadence
            <select
              name="cadence"
              required
              value={cadence}
              onChange={(e) => handleCadenceChange(e.target.value as QuestCadence)}
              className="mt-1.5 w-full border-2 border-[var(--gb-border)] bg-[var(--gb-panel-alt)] px-3 py-2 text-sm text-[var(--gb-text)] outline-none focus:border-[var(--gb-cyan)]"
            >
              {(Object.keys(CADENCE_LABELS) as QuestCadence[]).map((c) => (
                <option key={c} value={c}>
                  {CADENCE_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          {cadence === "daily" ? (
            <div>
              <span className="block text-xs text-[var(--gb-dim)]">Repeat on (blank = every day)</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((day) => {
                  const active = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      aria-pressed={active}
                      className="pixel-corners-sm border-2 px-2.5 py-1.5 text-[10px] font-medium"
                      style={
                        active
                          ? { borderColor: "var(--gb-cyan)", background: "var(--gb-cyan)", color: "var(--gb-bg)" }
                          : { borderColor: "var(--gb-border)", background: "var(--gb-panel-alt)", color: "var(--gb-dim)" }
                      }
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              {selectedDays.map((day) => (
                <input key={day} type="hidden" name="daysOfWeek" value={day} />
              ))}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 pt-2">
            {initialQuest ? (
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
      )}
      {confirmingDelete && initialQuest ? (
        <GamifyConfirmDialog
          title="DELETE QUEST"
          message={`Delete "${initialQuest.title}"? Past XP earned from it is kept.`}
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
