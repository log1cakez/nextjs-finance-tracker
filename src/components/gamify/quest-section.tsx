"use client";

import { useEffect, useRef, useState } from "react";
import type { GamifyCadenceSection, GamifyQuestSummary } from "@/app/actions/gamify-dashboard";
import { reorderGamifyQuests } from "@/app/actions/gamify-quests";
import { useCenterToast } from "@/components/center-toast";
import { QuestRow } from "@/components/gamify/quest-row";
import { XpBar } from "@/components/gamify/xp-bar";
import { periodLabelForCadence } from "@/lib/gamify-period";

const CADENCE_TITLES = {
  daily: "DAILY QUESTS",
  weekly: "WEEKLY QUESTS",
  monthly: "MONTHLY QUESTS",
} as const;

export function QuestSection({
  section,
  onEditQuest,
}: {
  section: GamifyCadenceSection;
  onEditQuest: (quest: GamifyQuestSummary) => void;
}) {
  const { showToast } = useCenterToast();
  const [quests, setQuests] = useState(section.quests);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const questsRef = useRef(quests);
  const rowEls = useRef(new Map<string, HTMLLIElement>());
  const drag = useRef<{ id: string; startOrder: GamifyQuestSummary[] } | null>(null);

  useEffect(() => {
    questsRef.current = quests;
  }, [quests]);

  // Adopt fresh server data — but not mid-drag, so the list doesn't jump under the pointer.
  useEffect(() => {
    if (!drag.current) setQuests(section.quests);
  }, [section.quests]);

  const progressPct = section.possibleXp > 0 ? (section.earnedXp / section.possibleXp) * 100 : 0;

  function setRowEl(id: string, el: HTMLLIElement | null) {
    if (el) rowEls.current.set(id, el);
    else rowEls.current.delete(id);
  }

  function reorderToPointer(pointerY: number) {
    const dragId = drag.current?.id;
    if (!dragId) return;
    setQuests((prev) => {
      const dragged = prev.find((q) => q.id === dragId);
      if (!dragged) return prev;
      const others = prev.filter((q) => q.id !== dragId);
      let targetIndex = others.length;
      for (let i = 0; i < others.length; i++) {
        const el = rowEls.current.get(others[i].id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (pointerY < rect.top + rect.height / 2) {
          targetIndex = i;
          break;
        }
      }
      others.splice(targetIndex, 0, dragged);
      return others;
    });
  }

  function handlePointerMove(e: PointerEvent) {
    if (!drag.current) return;
    reorderToPointer(e.clientY);
  }

  async function finishDrag() {
    const info = drag.current;
    drag.current = null;
    setDraggingId(null);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);
    if (!info) return;

    const finalOrder = questsRef.current;
    const changed = finalOrder.some((q, i) => q.id !== info.startOrder[i]?.id);
    if (!changed) return;

    const res = await reorderGamifyQuests(
      section.cadence,
      finalOrder.map((q) => q.id),
    );
    if (res.error) {
      showToast({ kind: "error", title: "Could not reorder", message: res.error, timeoutMs: 5200 });
      setQuests(info.startOrder);
    }
  }

  function startDrag(id: string, e: React.PointerEvent) {
    e.preventDefault();
    drag.current = { id, startOrder: quests };
    setDraggingId(id);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
  }

  return (
    <div className="pixel-panel pixel-corners min-w-0 p-4 sm:p-5">
      <div>
        <h2 className="pixel-font text-xs text-[var(--gb-cyan)]">{CADENCE_TITLES[section.cadence]}</h2>
        <p className="mt-1 text-[10px] text-[var(--gb-dim)]">{periodLabelForCadence(section.cadence)}</p>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10px] text-[var(--gb-dim)]">
          <span>
            {section.earnedXp} / {section.possibleXp} XP
          </span>
        </div>
        <XpBar progressPct={progressPct} color="var(--gb-green)" />
      </div>

      {quests.length === 0 ? (
        <p className="mt-4 text-xs text-[var(--gb-dim)]">No quests yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {quests.map((q) => (
            <QuestRow
              key={q.id}
              quest={q}
              onEdit={() => onEditQuest(q)}
              rowRef={(el) => setRowEl(q.id, el)}
              reorderable={quests.length > 1}
              dragging={draggingId === q.id}
              onDragHandlePointerDown={(e) => startDrag(q.id, e)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
