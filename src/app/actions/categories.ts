"use server";

import { and, asc, eq, ilike, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { categories, categoryDefinitions } from "@/db/schema";
import { normalizeCategoryNameKey } from "@/lib/category-name";
import { formatTypedLabel } from "@/lib/typed-label-format";
import { getSessionUserId } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  kind: z.enum(["income", "expense"]),
});

export type CategoryActionState = {
  error?: string;
  success?: boolean;
};

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function searchSuggestedCategoryNames(
  query: string,
  kind: "income" | "expense",
): Promise<{ name: string }[]> {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const key = normalizeCategoryNameKey(query);
  if (key.length < 2) {
    return [];
  }
  const db = getDb();
  const mine = await db
    .select({ definitionId: categories.definitionId })
    .from(categories)
    .where(eq(categories.userId, userId));
  const mineIds = mine.map((m) => m.definitionId);
  const pattern = `%${escapeIlikePattern(key)}%`;
  const rows = await db
    .select({ name: categoryDefinitions.name })
    .from(categoryDefinitions)
    .where(
      and(
        eq(categoryDefinitions.kind, kind),
        ilike(categoryDefinitions.nameKey, pattern),
        mineIds.length > 0
          ? notInArray(categoryDefinitions.id, mineIds)
          : sql`true`,
      ),
    )
    .orderBy(asc(categoryDefinitions.name))
    .limit(20);
  return rows;
}

export async function createCategory(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: "Sign in required" };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const trimmed = formatTypedLabel(parsed.data.name.trim());
  if (!trimmed) {
    return { error: "Name is required" };
  }
  const nameKey = normalizeCategoryNameKey(trimmed);
  const kind = parsed.data.kind;
  const db = getDb();

  let def = await db.query.categoryDefinitions.findFirst({
    where: and(
      eq(categoryDefinitions.nameKey, nameKey),
      eq(categoryDefinitions.kind, kind),
    ),
  });

  if (!def) {
    const [inserted] = await db
      .insert(categoryDefinitions)
      .values({ name: trimmed, nameKey, kind })
      .onConflictDoNothing({
        target: [categoryDefinitions.nameKey, categoryDefinitions.kind],
      })
      .returning();
    if (inserted) {
      def = inserted;
    } else {
      def = await db.query.categoryDefinitions.findFirst({
        where: and(
          eq(categoryDefinitions.nameKey, nameKey),
          eq(categoryDefinitions.kind, kind),
        ),
      });
    }
  }

  if (!def) {
    return { error: "Could not save category." };
  }

  const existing = await db.query.categories.findFirst({
    where: and(
      eq(categories.userId, userId),
      eq(categories.definitionId, def.id),
    ),
  });
  if (existing) {
    return { error: "That category is already in your list." };
  }

  try {
    await db.insert(categories).values({
      userId,
      definitionId: def.id,
      name: def.name,
      kind: def.kind,
    });
  } catch (err: unknown) {
    const code =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      typeof (err as { code: unknown }).code === "string"
        ? (err as { code: string }).code
        : null;
    if (code === "23505") {
      return { error: "That category is already in your list." };
    }
    throw err;
  }

  revalidatePath("/", "layout");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  revalidatePath("/recurring");
  return { success: true };
}

export async function deleteCategory(formData: FormData) {
  const userId = await getSessionUserId();
  if (!userId) {
    return;
  }
  const id = formData.get("id");
  if (typeof id !== "string" || !z.string().uuid().safeParse(id).success) {
    return;
  }
  await getDb()
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  revalidatePath("/", "layout");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  revalidatePath("/recurring");
}

export async function getCategories() {
  const userId = await getSessionUserId();
  if (!userId) {
    return [];
  }
  const db = getDb();
  return db.query.categories.findMany({
    where: eq(categories.userId, userId),
    orderBy: (categoriesTable, { asc }) => [
      asc(categoriesTable.kind),
      asc(categoriesTable.name),
    ],
  });
}
