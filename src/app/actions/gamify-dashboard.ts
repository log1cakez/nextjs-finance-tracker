"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { gamifyQuestCompletions, gamifyQuests, gamifyStats } from "@/db/schema";
import { getGamifyProfile } from "@/app/actions/gamify-profile";
import { ensureDefaultGamifyStats } from "@/app/actions/gamify-stats";
import { levelProgressForXp, type LevelProgress } from "@/lib/gamify-level";
import type { GamifyXpMode } from "@/lib/gamify-xp";
import {
  dailyPeriodKey,
  isDueOnDate,
  monthlyPeriodKey,
  parseDaysOfWeekJson,
  sundayOfWeek,
  weeklyPeriodKey,
  type QuestCadence,
  type WeekdayLabel,
} from "@/lib/gamify-period";
import { getSessionUserId } from "@/lib/session";

export type GamifyStatSummary = {
  id: string;
  name: string;
  icon: string;
  color: string;
  progress: LevelProgress;
};

export type GamifyQuestSummary = {
  id: string;
  title: string;
  xp: number;
  cadence: QuestCadence;
  stat: { id: string; name: string; icon: string; color: string };
  completed: boolean;
  /** Daily quests only: weekday labels it's due on. Empty = every day. */
  daysOfWeek: WeekdayLabel[];
  /** Daily quests only: whether today is one of `daysOfWeek` (always true for weekly/monthly). */
  dueToday: boolean;
};

export type GamifyCadenceSection = {
  cadence: QuestCadence;
  periodKey: string;
  quests: GamifyQuestSummary[];
  earnedXp: number;
  possibleXp: number;
};

export type GamifyActivityDay = {
  date: string;
  count: number;
};

export type GamifyActivity = {
  /** Consecutive days (ending today or, if nothing done yet today, yesterday) with >=1 completion. */
  streakDays: number;
  /** Sunday-aligned grid, oldest first, covering the last ~10 weeks through today. */
  heatmap: GamifyActivityDay[];
};

export type GamifyDashboardData = {
  characterName: string;
  xpMode: GamifyXpMode;
  character: LevelProgress;
  stats: GamifyStatSummary[];
  daily: GamifyCadenceSection;
  weekly: GamifyCadenceSection;
  monthly: GamifyCadenceSection;
  activity: GamifyActivity;
};

const HEATMAP_DAYS = 70;

function buildActivity(
  completions: { completedAt: Date }[],
  now: Date,
): GamifyActivity {
  const dayCounts = new Map<string, number>();
  for (const c of completions) {
    const key = dailyPeriodKey(c.completedAt);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  let streakDays = 0;
  const cursor = new Date(today);
  if (!dayCounts.has(dailyPeriodKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (dayCounts.has(dailyPeriodKey(cursor))) {
    streakDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const rangeStart = new Date(today);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - (HEATMAP_DAYS - 1));
  const gridStart = sundayOfWeek(rangeStart);

  const heatmap: GamifyActivityDay[] = [];
  const day = new Date(gridStart);
  while (day.getTime() <= today.getTime()) {
    const key = dailyPeriodKey(day);
    heatmap.push({ date: key, count: dayCounts.get(key) ?? 0 });
    day.setUTCDate(day.getUTCDate() + 1);
  }

  return { streakDays, heatmap };
}

function emptySection(cadence: QuestCadence, periodKey: string): GamifyCadenceSection {
  return { cadence, periodKey, quests: [], earnedXp: 0, possibleXp: 0 };
}

function emptyDashboard(): GamifyDashboardData {
  return {
    characterName: "Adventurer",
    xpMode: "auto",
    character: levelProgressForXp(0),
    stats: [],
    daily: emptySection("daily", dailyPeriodKey()),
    weekly: emptySection("weekly", weeklyPeriodKey()),
    monthly: emptySection("monthly", monthlyPeriodKey()),
    activity: buildActivity([], new Date()),
  };
}

export async function getGamifyDashboardData(): Promise<GamifyDashboardData> {
  const userId = await getSessionUserId();
  if (!userId) {
    return emptyDashboard();
  }
  const db = getDb();
  const now = new Date();

  await ensureDefaultGamifyStats(db, userId);

  const [profile, stats, quests, completions] = await Promise.all([
    getGamifyProfile(userId),
    db.query.gamifyStats.findMany({
      where: eq(gamifyStats.userId, userId),
      orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.name)],
    }),
    db.query.gamifyQuests.findMany({
      where: eq(gamifyQuests.userId, userId),
      orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.title)],
      with: { stat: true },
    }),
    db.query.gamifyQuestCompletions.findMany({
      where: eq(gamifyQuestCompletions.userId, userId),
    }),
  ]);

  const xpByStatId = new Map<string, number>();
  let characterTotalXp = 0;
  for (const c of completions) {
    characterTotalXp += c.xpAwarded;
    if (c.statId) {
      xpByStatId.set(c.statId, (xpByStatId.get(c.statId) ?? 0) + c.xpAwarded);
    }
  }

  const statSummaries: GamifyStatSummary[] = stats.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    color: s.color,
    progress: levelProgressForXp(xpByStatId.get(s.id) ?? 0),
  }));

  const periodKeys: Record<QuestCadence, string> = {
    daily: dailyPeriodKey(now),
    weekly: weeklyPeriodKey(now),
    monthly: monthlyPeriodKey(now),
  };

  const completionKey = (questId: string, periodKey: string) => `${questId}::${periodKey}`;
  const completedSet = new Set(
    completions
      .filter((c): c is typeof c & { questId: string } => c.questId !== null)
      .map((c) => completionKey(c.questId, c.periodKey)),
  );

  function buildSection(cadence: QuestCadence): GamifyCadenceSection {
    const periodKey = periodKeys[cadence];
    let earnedXp = 0;
    let possibleXp = 0;
    const questSummaries: GamifyQuestSummary[] = quests
      .filter((q) => q.cadence === cadence)
      .map((q) => {
        const daysOfWeek = cadence === "daily" ? parseDaysOfWeekJson(q.daysOfWeekJson) : [];
        const dueToday = cadence !== "daily" || isDueOnDate(daysOfWeek, now);
        const completed = completedSet.has(completionKey(q.id, periodKey));
        if (dueToday) {
          possibleXp += q.xp;
          if (completed) earnedXp += q.xp;
        }
        return {
          id: q.id,
          title: q.title,
          xp: q.xp,
          cadence: q.cadence,
          stat: { id: q.stat.id, name: q.stat.name, icon: q.stat.icon, color: q.stat.color },
          completed,
          daysOfWeek,
          dueToday,
        };
      });
    return { cadence, periodKey, quests: questSummaries, earnedXp, possibleXp };
  }

  return {
    characterName: profile.characterName,
    xpMode: profile.xpMode,
    character: levelProgressForXp(characterTotalXp),
    stats: statSummaries,
    daily: buildSection("daily"),
    weekly: buildSection("weekly"),
    monthly: buildSection("monthly"),
    activity: buildActivity(completions, now),
  };
}
