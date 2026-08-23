"use client";

import type { GamifyCadenceSection, GamifyQuestSummary } from "@/app/actions/gamify-dashboard";
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
  const progressPct = section.possibleXp > 0 ? (section.earnedXp / section.possibleXp) * 100 : 0;

  return (
    <div className="pixel-panel pixel-corners p-4 sm:p-5">
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

      {section.quests.length === 0 ? (
        <p className="mt-4 text-xs text-[var(--gb-dim)]">No quests yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {section.quests.map((q) => (
            <QuestRow key={q.id} quest={q} onEdit={() => onEditQuest(q)} />
          ))}
        </ul>
      )}
    </div>
  );
}
