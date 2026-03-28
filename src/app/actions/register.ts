"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";

const registerSchema = z.object({
  name: z.string().max(120).optional(),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export type RegisterState = { error?: string; success?: boolean };

export async function registerUser(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const db = getDb();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const name =
    parsed.data.name?.trim() ||
    email.split("@")[0]?.slice(0, 80) ||
    "User";

  await db.insert(users).values({
    email,
    name,
    passwordHash,
  });

  return { success: true };
}
