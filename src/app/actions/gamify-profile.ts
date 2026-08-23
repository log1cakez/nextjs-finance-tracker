"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { gamifyProfiles } from "@/db/schema";
import type { GamifyXpMode } from "@/lib/gamify-xp";
import { getSessionUserId } from "@/lib/session";

export type GamifyProfileActionState = {
  error?: string;
  success?: boolean;
};

export type GamifyProfile = {
  characterName: string;
  xpMode: GamifyXpMode;
};

const DEFAULT_PROFILE: GamifyProfile = { characterName: "Adventurer", xpMode: "auto" };

const nameSchema = z.string().trim().min(1, "Name is required").max(40);
const xpModeSchema = z.enum(["auto", "manual"]);

export async function updateGamifyCharacterName(
  _prev: GamifyProfileActionState,
  formData: FormData,
): Promise<GamifyProfileActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  const parsed = nameSchema.safeParse(formData.get("characterName"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }
  const db = getDb();
  await db
    .insert(gamifyProfiles)
    .values({ userId, characterName: parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: gamifyProfiles.userId,
      set: { characterName: parsed.data, updatedAt: new Date() },
    });
  revalidatePath("/gamify");
  return { success: true };
}

export async function updateGamifyXpMode(
  _prev: GamifyProfileActionState,
  formData: FormData,
): Promise<GamifyProfileActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }
  const parsed = xpModeSchema.safeParse(formData.get("xpMode"));
  if (!parsed.success) {
    return { error: "Invalid XP mode" };
  }
  const db = getDb();
  await db
    .insert(gamifyProfiles)
    .values({ userId, xpMode: parsed.data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: gamifyProfiles.userId,
      set: { xpMode: parsed.data, updatedAt: new Date() },
    });
  revalidatePath("/gamify");
  return { success: true };
}

export async function getGamifyProfile(userId: string): Promise<GamifyProfile> {
  const db = getDb();
  const profile = await db.query.gamifyProfiles.findFirst({
    where: eq(gamifyProfiles.userId, userId),
  });
  if (!profile) return DEFAULT_PROFILE;
  return { characterName: profile.characterName, xpMode: profile.xpMode };
}
