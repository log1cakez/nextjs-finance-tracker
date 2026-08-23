/**
 * Total XP needed to reach `level`. Matches the classic "+500 XP per level" curve:
 * L1=0, L2=500, L3=1500, L4=3000, L5=5000, L6=7500, L7=10500, L8=14000, L9=18000, L10=22500.
 */
export function totalXpForLevel(level: number): number {
  return 250 * level * (level - 1);
}

export type LevelProgress = {
  level: number;
  totalXp: number;
  /** XP earned since hitting the current level. */
  xpIntoLevel: number;
  /** XP needed to go from the current level to the next. */
  xpForNextLevel: number;
  /** 0-100 */
  progressPct: number;
};

export function levelProgressForXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, totalXp);
  let level = 1;
  while (totalXpForLevel(level + 1) <= xp) {
    level += 1;
  }
  const currentLevelXp = totalXpForLevel(level);
  const nextLevelXp = totalXpForLevel(level + 1);
  const xpForNextLevel = nextLevelXp - currentLevelXp;
  const xpIntoLevel = xp - currentLevelXp;
  const progressPct =
    xpForNextLevel > 0 ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100;
  return { level, totalXp: xp, xpIntoLevel, xpForNextLevel, progressPct };
}
