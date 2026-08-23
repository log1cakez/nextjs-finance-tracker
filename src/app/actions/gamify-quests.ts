"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { gamifyQuestCompletions, gamifyQuestCadence, gamifyQuests } from "@/db/schema";
import { isDueOnDate, parseDaysOfWeekJson, periodKeyForCadence, WEEKDAY_LABELS } from "@/lib/gamify-period";
import { getSessionUserId } from "@/lib/session";

const cadenceEnum = z.enum(gamifyQuestCadence.enumValues);
const weekdayEnum = z.enum(WEEKDAY_LABELS);

const questSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  statId: z.string().uuid("Pick a stat"),
  cadence: cadenceEnum,
  xp: z.coerce.number().int().min(1, "XP must be at least 1").max(999, "XP must be 999 or less"),
});

function parseDaysOfWeek(formData: FormData, cadence: z.infer<typeof cadenceEnum>): string[] {
  if (cadence !== "daily") {
    return [];
  }
  const parsed = z.array(weekdayEnum).safeParse(formData.getAll("daysOfWeek"));
  return parsed.success ? parsed.data : [];
}

export type GamifyQuestActionState = {
  error?: string;
  success?: boolean;
};

async function assertOwnedStat(db: ReturnType<typeof getDb>, userId: string, statId: string) {
  const stat = await db.query.gamifyStats.findFirst({
    where: (t, { and: andFn, eq: eqFn }) => andFn(eqFn(t.id, statId), eqFn(t.userId, userId)),
  });
  return stat ?? null;
}

export async function createGamifyQuest(
  _prev: GamifyQuestActionState,
  formData: FormData,
): Promise<GamifyQuestActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  const parsed = questSchema.safeParse({
    title: formData.get("title"),
    statId: formData.get("statId"),
    cadence: formData.get("cadence"),
    xp: formData.get("xp"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const db = getDb();
  const stat = await assertOwnedStat(db, userId, parsed.data.statId);
  if (!stat) {
    return { error: "Pick a valid stat" };
  }
  await db.insert(gamifyQuests).values({
    userId,
    statId: stat.id,
    title: parsed.data.title,
    cadence: parsed.data.cadence,
    xp: parsed.data.xp,
    daysOfWeekJson: JSON.stringify(parseDaysOfWeek(formData, parsed.data.cadence)),
  });
  revalidatePath("/gamify");
  return { success: true };
}

export async function updateGamifyQuest(
  _prev: GamifyQuestActionState,
  formData: FormData,
): Promise<GamifyQuestActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return { error: "Invalid quest" };
  }
  const parsed = questSchema.safeParse({
    title: formData.get("title"),
    statId: formData.get("statId"),
    cadence: formData.get("cadence"),
    xp: formData.get("xp"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const db = getDb();
  const stat = await assertOwnedStat(db, userId, parsed.data.statId);
  if (!stat) {
    return { error: "Pick a valid stat" };
  }
  await db
    .update(gamifyQuests)
    .set({
      title: parsed.data.title,
      statId: stat.id,
      cadence: parsed.data.cadence,
      xp: parsed.data.xp,
      daysOfWeekJson: JSON.stringify(parseDaysOfWeek(formData, parsed.data.cadence)),
      updatedAt: new Date(),
    })
    .where(and(eq(gamifyQuests.id, id), eq(gamifyQuests.userId, userId)));
  revalidatePath("/gamify");
  return { success: true };
}

export async function deleteGamifyQuest(
  _prev: GamifyQuestActionState,
  formData: FormData,
): Promise<GamifyQuestActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return { error: "Invalid quest" };
  }
  const db = getDb();
  await db.delete(gamifyQuests).where(and(eq(gamifyQuests.id, id), eq(gamifyQuests.userId, userId)));
  revalidatePath("/gamify");
  return { success: true };
}

export async function toggleGamifyQuestCompletion(
  _prev: GamifyQuestActionState,
  formData: FormData,
): Promise<GamifyQuestActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  const questId = formData.get("questId");
  if (typeof questId !== "string" || !z.string().uuid().safeParse(questId).success) {
    return { error: "Invalid quest" };
  }
  const db = getDb();
  const quest = await db.query.gamifyQuests.findFirst({
    where: and(eq(gamifyQuests.id, questId), eq(gamifyQuests.userId, userId)),
    with: { stat: true },
  });
  if (!quest) {
    return { error: "Quest not found" };
  }
  const periodKey = periodKeyForCadence(quest.cadence);
  const existing = await db.query.gamifyQuestCompletions.findFirst({
    where: and(
      eq(gamifyQuestCompletions.questId, quest.id),
      eq(gamifyQuestCompletions.periodKey, periodKey),
      eq(gamifyQuestCompletions.userId, userId),
    ),
  });
  if (existing) {
    await db
      .delete(gamifyQuestCompletions)
      .where(and(eq(gamifyQuestCompletions.id, existing.id), eq(gamifyQuestCompletions.userId, userId)));
  } else {
    if (quest.cadence === "daily" && !isDueOnDate(parseDaysOfWeekJson(quest.daysOfWeekJson))) {
      return { error: "This quest isn't scheduled for today." };
    }
    await db.insert(gamifyQuestCompletions).values({
      userId,
      questId: quest.id,
      statId: quest.statId,
      questTitle: quest.title,
      statName: quest.stat.name,
      statIcon: quest.stat.icon,
      statColor: quest.stat.color,
      cadence: quest.cadence,
      xpAwarded: quest.xp,
      periodKey,
    });
  }
  revalidatePath("/gamify");
  return { success: true };
}
