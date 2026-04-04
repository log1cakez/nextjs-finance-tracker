import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { resolveDatabaseUrl } from "@/lib/resolve-database-url";
import { schema } from "./schema";

export { resolveDatabaseUrl } from "@/lib/resolve-database-url";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | null = null;

export function getDb(): Db {
  if (cached) {
    return cached;
  }
  const url = resolveDatabaseUrl();
  cached = drizzle(neon(url), { schema });
  return cached;
}
