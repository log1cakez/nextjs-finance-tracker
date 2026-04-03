"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { formatTypedLabel } from "@/lib/typed-label-format";

const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Use at most 120 characters"),
});

export type UpdateNameState = { error?: string; success?: boolean };

export async function updateDisplayName(
  _prev: UpdateNameState,
  formData: FormData,
): Promise<UpdateNameState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const parsed = nameSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid name";
    return { error: msg };
  }

  const displayName = formatTypedLabel(parsed.data.name);
  if (!displayName) {
    return { error: "Name is required" };
  }

  const db = getDb();
  await db
    .update(users)
    .set({ name: displayName })
    .where(eq(users.id, session.user.id));

  revalidatePath("/financetracker", "layout");
  revalidatePath("/financetracker/account");
  return { success: true };
}
