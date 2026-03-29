import { createHash, randomBytes } from "node:crypto";

export function generateCalendarFeedSecret(): string {
  return randomBytes(32).toString("hex");
}

export function hashCalendarFeedSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}
