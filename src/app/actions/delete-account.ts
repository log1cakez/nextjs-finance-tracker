"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth, signOut } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";

const schema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
});

export type DeleteAccountState = { error?: string };

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in" };
  }

  const parsed = schema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    return {
      error:
        "No password is set for this account. Account deletion here requires your email login password.",
    };
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return { error: "Password is incorrect" };
  }

  await db.delete(users).where(eq(users.id, user.id));

  await signOut({ redirectTo: "/login?deleted=1" });
  return {};
}
