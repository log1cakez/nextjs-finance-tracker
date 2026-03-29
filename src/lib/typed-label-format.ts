/**
 * Display naming for user-typed labels (names, descriptions, notes).
 *
 * - If every Latin letter A–Z in the value is uppercase, the string is kept as-is
 *   (e.g. "GCASH", "NASA", "BDO DEBIT").
 * - Otherwise each word is capitalized: first letter upper, following letters lower
 *   (e.g. "groceries" → "Groceries", "hello world" → "Hello World").
 */

function titleCaseWord(word: string): string {
  const lower = word.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i]!;
    const up = c.toUpperCase();
    const lo = c.toLowerCase();
    if (up !== lo) {
      return lower.slice(0, i) + up + lower.slice(i + 1);
    }
  }
  return word;
}

export function formatTypedLabel(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) {
    return "";
  }

  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 0 && letters === letters.toUpperCase()) {
    return trimmed;
  }

  return trimmed.split(" ").map(titleCaseWord).join(" ");
}

/** Same rules as {@link formatTypedLabel}, one line at a time (keeps newline characters). */
export function formatTypedBlock(input: string): string {
  return input
    .split(/\r?\n/)
    .map((line) => formatTypedLabel(line))
    .join("\n");
}
