"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { gamifyStats } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const statSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  icon: z.string().trim().max(8).optional().default(""),
  color: z
    .string()
    .trim()
    .regex(HEX_COLOR_RE, "Pick a color")
    .optional()
    .default("#22d3ee"),
});

export type GamifyStatActionState = {
  error?: string;
  success?: boolean;
};

/** Seeded for a brand-new user so the dashboard isn't empty on first visit. */
const DEFAULT_GAMIFY_STATS = [
  { name: "Trading", icon: "📈", color: "#4deaff" },
  { name: "Endurance", icon: "🏃", color: "#fb923c" },
  { name: "Strength", icon: "💪", color: "#ffe14d" },
  { name: "Order", icon: "🧹", color: "#a78bfa" },
  { name: "Wisdom", icon: "📖", color: "#52ff9d" },
  { name: "Health", icon: "❤️", color: "#ff6b6b" },
] as const;

/** Inserts the default stat set for `userId` only if they have no stats yet. */
export async function ensureDefaultGamifyStats(db: ReturnType<typeof getDb>, userId: string) {
  const existing = await db.query.gamifyStats.findFirst({
    where: eq(gamifyStats.userId, userId),
    columns: { id: true },
  });
  if (existing) {
    return;
  }
  await db
    .insert(gamifyStats)
    .values(
      DEFAULT_GAMIFY_STATS.map((s, i) => ({
        userId,
        name: s.name,
        icon: s.icon,
        color: s.color,
        sortOrder: i,
      })),
    )
    .onConflictDoNothing();
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505";
}

function isRestrictViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23503";
}

export async function listGamifyStats() {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const db = getDb();
  return db.query.gamifyStats.findMany({
    where: eq(gamifyStats.userId, userId),
    orderBy: (t, { asc: ascFn }) => [ascFn(t.sortOrder), ascFn(t.name)],
  });
}

export async function createGamifyStat(
  _prev: GamifyStatActionState,
  formData: FormData,
): Promise<GamifyStatActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  const parsed = statSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
    color: formData.get("color"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const db = getDb();
  try {
    await db.insert(gamifyStats).values({
      userId,
      name: parsed.data.name,
      icon: parsed.data.icon,
      color: parsed.data.color,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "You already have a stat with that name." };
    }
    throw err;
  }
  revalidatePath("/gamify");
  return { success: true };
}

export async function updateGamifyStat(
  _prev: GamifyStatActionState,
  formData: FormData,
): Promise<GamifyStatActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return { error: "Invalid stat" };
  }
  const parsed = statSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
    color: formData.get("color"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const db = getDb();
  try {
    await db
      .update(gamifyStats)
      .set({ name: parsed.data.name, icon: parsed.data.icon, color: parsed.data.color })
      .where(and(eq(gamifyStats.id, id), eq(gamifyStats.userId, userId)));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "You already have a stat with that name." };
    }
    throw err;
  }
  revalidatePath("/gamify");
  return { success: true };
}

export async function deleteGamifyStat(
  _prev: GamifyStatActionState,
  formData: FormData,
): Promise<GamifyStatActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return { error: "Invalid stat" };
  }
  const db = getDb();
  try {
    await db
      .delete(gamifyStats)
      .where(and(eq(gamifyStats.id, id), eq(gamifyStats.userId, userId)));
  } catch (err) {
    if (isRestrictViolation(err)) {
      return { error: "Reassign or delete that stat's quests first." };
    }
    throw err;
  }
  revalidatePath("/gamify");
  return { success: true };
}
