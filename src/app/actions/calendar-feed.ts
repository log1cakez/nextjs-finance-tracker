"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  generateCalendarFeedSecret,
  hashCalendarFeedSecret,
} from "@/lib/calendar-feed-crypto";
import { getSessionUserId } from "@/lib/session";

export type CalendarFeedActionState = {
  error?: string;
  /** Full secret token — show to user once to build subscription URL. */
  newToken?: string;
  success?: boolean;
};

function calendarFeedBaseUrl(): string {
  const u = process.env.AUTH_URL?.trim();
  if (u) {
    return u.replace(/\/$/, "");
  }
  return "";
}

export async function getCalendarFeedStatus(): Promise<{
  hasActiveFeed: boolean;
  subscriptionUrlHint: string;
}> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { hasActiveFeed: false, subscriptionUrlHint: "" };
  }
  const db = getDb();
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { calendarFeedTokenHash: true },
  });
  const base = calendarFeedBaseUrl();
  return {
    hasActiveFeed: Boolean(row?.calendarFeedTokenHash),
    subscriptionUrlHint: base
      ? `${base}/api/calendar/feed?token=(your secret token)`
      : "(your site origin)/api/calendar/feed?token=(your secret token)",
  };
}

export async function createCalendarFeedToken(
  _prev: CalendarFeedActionState,
  _formData: FormData,
): Promise<CalendarFeedActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }

  const secret = generateCalendarFeedSecret();
  const hash = hashCalendarFeedSecret(secret);

  const db = getDb();
  try {
    await db
      .update(users)
      .set({ calendarFeedTokenHash: hash })
      .where(eq(users.id, userId));
  } catch {
    return {
      error:
        "Could not save calendar link. If this persists, ensure the database migration for calendar_feed_token_hash ran.",
    };
  }

  revalidatePath("/financetracker/account");
  return { success: true, newToken: secret };
}

export async function revokeCalendarFeedToken(
  _prev: CalendarFeedActionState,
  _formData: FormData,
): Promise<CalendarFeedActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }

  await getDb()
    .update(users)
    .set({ calendarFeedTokenHash: null })
    .where(eq(users.id, userId));

  revalidatePath("/financetracker/account");
  return { success: true };
}
