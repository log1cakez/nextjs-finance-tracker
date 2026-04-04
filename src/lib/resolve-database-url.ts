/**
 * When `MIDAS_RUNTIME_MODE=dev`, uses `DATABASE_URL_DEV` if set; otherwise `DATABASE_URL`.
 * Used by `getDb()` and drizzle-kit so CLI targets the same DB as the app.
 */
export function resolveDatabaseUrl(): string {
  const mode = process.env.MIDAS_RUNTIME_MODE?.trim().toLowerCase();
  if (mode === "dev") {
    const devUrl = process.env.DATABASE_URL_DEV?.trim();
    if (devUrl) {
      return devUrl;
    }
  }
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is missing. Add it to .env.local or your host. When MIDAS_RUNTIME_MODE=dev you can use DATABASE_URL_DEV instead.",
    );
  }
  return url;
}
