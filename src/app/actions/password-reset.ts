"use server";

import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { passwordResetOtps, users } from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/send-email";

const emailSchema = z.string().email("Enter a valid email");

const resetSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    otp: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
    newPassword: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RequestOtpState = {
  error?: string;
  success?: boolean;
  /** Present when a code was emailed (account had password sign-in). */
  email?: string;
};

export async function requestPasswordResetOtp(
  _prev: RequestOtpState,
  formData: FormData,
): Promise<RequestOtpState> {
  const raw = formData.get("email");
  const parsed = emailSchema.safeParse(
    typeof raw === "string" ? raw.trim() : "",
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }
  const email = parsed.data.toLowerCase();

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, passwordHash: true },
  });

  if (user?.passwordHash) {
    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.delete(passwordResetOtps).where(eq(passwordResetOtps.email, email));
    await db.insert(passwordResetOtps).values({
      email,
      codeHash,
      expiresAt,
    });

    const sent = await sendTransactionalEmail({
      to: email,
      subject: "MIDAS Finance Tracker — your password reset code",
      text: `Your one-time code is: ${code}\n\nIt expires in 15 minutes. If you did not request this, ignore this email.`,
    });

    if (!sent.ok) {
      await db.delete(passwordResetOtps).where(eq(passwordResetOtps.email, email));
      return { error: sent.error };
    }
    return { success: true, email };
  }

  return { success: true };
}

export type ResetPasswordState = { error?: string; success?: boolean };

export async function resetPasswordWithOtp(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse({
    email: formData.get("email"),
    otp: formData.get("otp"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const db = getDb();

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) {
    return { error: "Invalid code or email" };
  }

  const rows = await db
    .select()
    .from(passwordResetOtps)
    .where(
      and(
        eq(passwordResetOtps.email, email),
        gt(passwordResetOtps.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(passwordResetOtps.createdAt))
    .limit(1);
  const row = rows[0];

  if (!row) {
    return { error: "Invalid or expired code. Request a new one." };
  }

  const ok = await bcrypt.compare(parsed.data.otp, row.codeHash);
  if (!ok) {
    return { error: "Invalid or expired code. Request a new one." };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, user.id));

  await db.delete(passwordResetOtps).where(eq(passwordResetOtps.email, email));

  return { success: true };
}
