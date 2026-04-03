import { getCategories } from "@/app/actions/categories";
import { CategoryManager } from "@/components/category-manager";

export default async function CategoriesPage() {
  const items = await getCategories();

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Categories
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Group income and expenses. Transactions can link to a matching category.
        </p>
      </div>

      <CategoryManager items={items} />
    </div>
  );
}
