/** Header / auth brand: MIDAS in gold gradient, subtitle in neutral type. */
export function BrandMark() {
  return (
    <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0 sm:gap-x-2">
      <span className="bg-gradient-to-r from-amber-700 via-yellow-500 to-amber-500 bg-clip-text text-lg font-bold tracking-[0.12em] text-transparent uppercase drop-shadow-[0_0_24px_rgba(245,158,11,0.25)] sm:text-xl sm:tracking-[0.2em] dark:from-amber-200 dark:via-yellow-300 dark:to-amber-400 dark:drop-shadow-[0_0_20px_rgba(251,191,36,0.2)]">
        Midas
      </span>
      <span className="text-[0.95rem] font-semibold tracking-tight text-zinc-800 dark:text-zinc-100 sm:text-lg">
        Finance Tracker
      </span>
    </span>
  );
}
