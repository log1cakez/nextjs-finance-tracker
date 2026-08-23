import type { gamifyQuestCadence } from "@/db/schema";

export type QuestCadence = (typeof gamifyQuestCadence.enumValues)[number];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** UTC day, e.g. "2026-08-23". */
export function dailyPeriodKey(now = new Date()): string {
  return isoDate(now);
}

/** Sunday that starts the UTC week containing `now` — Sunday-first, matching the rest of the app. */
export function sundayOfWeek(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

export function weeklyPeriodKey(now = new Date()): string {
  return isoDate(sundayOfWeek(now));
}

/** "2026-08" */
export function monthlyPeriodKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodKeyForCadence(cadence: QuestCadence, now = new Date()): string {
  if (cadence === "daily") return dailyPeriodKey(now);
  if (cadence === "weekly") return weeklyPeriodKey(now);
  return monthlyPeriodKey(now);
}

/** Index 0-6 matches `Date#getUTCDay()` (0 = Sunday). */
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type WeekdayLabel = (typeof WEEKDAY_LABELS)[number];

export function weekdayLabelForDate(now = new Date()): WeekdayLabel {
  return WEEKDAY_LABELS[now.getUTCDay()];
}

/** `daysOfWeek` empty = every day. Otherwise only true on the listed weekdays. */
export function isDueOnDate(daysOfWeek: readonly string[], now = new Date()): boolean {
  return daysOfWeek.length === 0 || daysOfWeek.includes(weekdayLabelForDate(now));
}

export function parseDaysOfWeekJson(raw: string): WeekdayLabel[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is WeekdayLabel => WEEKDAY_LABELS.includes(x as WeekdayLabel));
  } catch {
    return [];
  }
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTH_NAMES = MONTH_NAMES.map((m) => m.slice(0, 3));

function formatShort(d: Date): string {
  return `${SHORT_MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function periodLabelForCadence(cadence: QuestCadence, now = new Date()): string {
  if (cadence === "daily") {
    return "Today";
  }
  if (cadence === "weekly") {
    const start = sundayOfWeek(now);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return `This Week — ${formatShort(start)} to ${formatShort(end)}`;
  }
  return `This Month — ${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
}
