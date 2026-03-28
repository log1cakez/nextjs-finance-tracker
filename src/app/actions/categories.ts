"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  kind: z.enum(["income", "expense"]),
});

export type CategoryActionState = {
  error?: string;
  success?: boolean;
};

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

  await getDb().insert(categories).values({
    userId,
    name: parsed.data.name.trim(),
    kind: parsed.data.kind,
  });

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
