"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { GamifyQuestSummary } from "@/app/actions/gamify-dashboard";
import { toggleGamifyQuestCompletion, type GamifyQuestActionState } from "@/app/actions/gamify-quests";
import { useToastOnActionError } from "@/components/center-toast";
import { useGamifySound } from "@/components/gamify/gamify-sound-provider";

const initial: GamifyQuestActionState = {};

export function QuestRow({ quest, onEdit }: { quest: GamifyQuestSummary; onEdit: () => void }) {
  const [state, formAction, pending] = useActionState(toggleGamifyQuestCompletion, initial);
  useToastOnActionError(state.error, pending, "Could not update quest");
  const { play } = useGamifySound();
  const [showXpPop, setShowXpPop] = useState(false);
  const firstRun = useRef(true);
  const scheduleLabel =
    quest.cadence === "daily" && quest.daysOfWeek.length > 0 ? quest.daysOfWeek.join(" · ") : null;

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (state.success && quest.completed) {
      play("questDone");
      setShowXpPop(true);
      const t = setTimeout(() => setShowXpPop(false), 900);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, quest.completed]);

  return (
    <li
      className={`pixel-panel pixel-corners-sm relative flex items-center gap-3 p-3 ${
        quest.dueToday ? "" : "opacity-50"
      }`}
    >
      <form action={formAction}>
        <input type="hidden" name="questId" value={quest.id} />
        <input
          key={`${quest.id}-${quest.completed}`}
          type="checkbox"
          className="pixel-checkbox"
          defaultChecked={quest.completed}
          disabled={pending || !quest.dueToday}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          aria-label={`Mark "${quest.title}" complete`}
          title={quest.dueToday ? undefined : "Not scheduled for today"}
        />
      </form>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p
          className={`truncate text-sm ${
            quest.completed ? "text-[var(--gb-dim)] line-through" : "text-[var(--gb-text)]"
          }`}
        >
          {quest.title}
        </p>
        <p className="mt-0.5 text-[10px]" style={{ color: quest.stat.color }}>
          {quest.stat.icon} {quest.stat.name}
          {scheduleLabel ? <span className="text-[var(--gb-dim)]"> · {scheduleLabel}</span> : null}
        </p>
      </button>
      <span className="pixel-font shrink-0 text-[10px] text-[var(--gb-yellow)]">+{quest.xp}</span>
      {showXpPop ? <span className="gamify-xp-pop pixel-font">+{quest.xp} XP</span> : null}
    </li>
  );
}
