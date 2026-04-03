import type { ExpenseMoodTier } from "@/lib/expense-mood";
import { expenseMoodContent } from "@/lib/expense-mood";

export function ExpenseMoodGif({
  tier,
  className = "",
}: {
  tier: ExpenseMoodTier;
  className?: string;
}) {
  const m = expenseMoodContent(tier);
  return (
    <div
      className={`flex w-full flex-col items-center gap-2 ${className}`.trim()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote GIF; no next/image host config */}
      <img
        src={m.url}
        alt={m.alt}
        width={152}
        height={152}
        referrerPolicy="no-referrer"
        className="h-24 w-24 rounded-lg border border-zinc-300/50 bg-zinc-100/80 object-cover shadow-sm dark:border-zinc-500/40 dark:bg-zinc-900/80 sm:h-28 sm:w-28"
        loading="lazy"
      />
      <p className="mx-auto max-w-sm text-center text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
        {m.caption}
      </p>
    </div>
  );
}
