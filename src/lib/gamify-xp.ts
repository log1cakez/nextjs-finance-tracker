import type { QuestCadence } from "@/lib/gamify-period";

/** Fixed default XP per cadence, used in "manual" mode — still editable per quest. */
export const DEFAULT_XP_BY_CADENCE: Record<QuestCadence, number> = {
  daily: 10,
  weekly: 50,
  monthly: 200,
};

export type GamifyXpMode = "auto" | "manual";

/**
 * "auto" mode: roughly how many completions of this cadence it should take to
 * earn one level-up's worth of XP, so new quests stay meaningful as you level up
 * instead of shrinking toward irrelevance against the XP curve.
 */
const AUTO_XP_COMPLETIONS_PER_LEVEL: Record<QuestCadence, number> = {
  daily: 50,
  weekly: 10,
  monthly: 2.5,
};

const AUTO_XP_ROUNDING: Record<QuestCadence, number> = {
  daily: 5,
  weekly: 10,
  monthly: 25,
};

/** XP required to go from `level` to `level + 1` (matches `totalXpForLevel`'s curve: 500 * level). */
function xpToNextLevel(level: number): number {
  return 500 * Math.max(1, level);
}

/** Suggested XP for a new quest of this cadence at the character's current level. */
export function autoXpForCadence(cadence: QuestCadence, level: number): number {
  const raw = xpToNextLevel(level) / AUTO_XP_COMPLETIONS_PER_LEVEL[cadence];
  const step = AUTO_XP_ROUNDING[cadence];
  const rounded = Math.round(raw / step) * step;
  return Math.max(step, Math.min(999, rounded));
}

export function suggestedXpForCadence(mode: GamifyXpMode, cadence: QuestCadence, level: number): number {
  return mode === "auto" ? autoXpForCadence(cadence, level) : DEFAULT_XP_BY_CADENCE[cadence];
}
