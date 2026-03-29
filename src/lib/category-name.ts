/** Normalized key for matching category names across users (trim, lower, collapse spaces). */
export function normalizeCategoryNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
