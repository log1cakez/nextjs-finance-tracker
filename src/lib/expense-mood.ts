export type ExpenseMoodTier = 0 | 1 | 2 | 3 | 4;

/**
 * Compare month-to-date expenses to prorated projected monthly burn
 * (`projectedExpenseMinor` from dashboard overview). Higher tier = more "ouch."
 */
export function getExpenseMoodTier(
  monthToDateExpensesCents: number,
  projectedMonthlyExpenseCents: number,
  referenceDate: Date = new Date(),
): ExpenseMoodTier {
  const day = referenceDate.getDate();
  const daysInMonth = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0,
  ).getDate();
  const pace = Math.max(day / daysInMonth, 1 / daysInMonth);

  if (projectedMonthlyExpenseCents <= 0) {
    if (monthToDateExpensesCents <= 0) return 0;
    const quarterK = 25_00;
    if (monthToDateExpensesCents < quarterK) return 1;
    if (monthToDateExpensesCents < quarterK * 4) return 2;
    if (monthToDateExpensesCents < quarterK * 12) return 3;
    return 4;
  }

  const expectedSoFar = projectedMonthlyExpenseCents * pace;
  const ratio =
    expectedSoFar > 0 ? monthToDateExpensesCents / expectedSoFar : 0;

  if (ratio < 0.62) return 0;
  if (ratio < 0.88) return 1;
  if (ratio < 1.06) return 2;
  if (ratio < 1.32) return 3;
  return 4;
}

export function expenseMoodContent(tier: ExpenseMoodTier): {
  url: string;
  alt: string;
  caption: string;
} {
  /** IDs verified to return real GIF bytes (404s show Giphy’s “content not available” tile). */
  const moods: Record<ExpenseMoodTier, { url: string; alt: string; caption: string }> =
    {
      0: {
        url: "https://media.giphy.com/media/l0HlNaQ6gWfllcjDO/giphy.gif",
        alt: "Celebrating",
        caption: "Barely spent. Are you even alive?",
      },
      1: {
        url: "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif",
        alt: "Cool",
        caption: "Chill pace. The spreadsheet is proud.",
      },
      2: {
        url: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif",
        alt: "Looking around",
        caption: "On track. Suspiciously normal.",
      },
      3: {
        url: "https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif",
        alt: "Stress",
        caption: "Over the line a bit. Wallet sent a push notification.",
      },
      4: {
        url: "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif",
        alt: "Monkey panic",
        caption: "Budget who? We’re in improv mode now.",
      },
    };
  return moods[tier];
}
