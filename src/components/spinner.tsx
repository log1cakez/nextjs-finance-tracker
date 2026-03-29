/** Accessible loading indicator (amber accent matches brand). */
export function Spinner({
  size = "md",
  className = "",
  decorative = false,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** When true, no `role="status"` (use inside buttons that already announce state). */
  decorative?: boolean;
}) {
  const dims =
    size === "sm"
      ? "h-4 w-4 border-2"
      : size === "lg"
        ? "h-10 w-10 border-[3px]"
        : "h-6 w-6 border-2";

  const ring = (
    <span
      className={`${dims} rounded-full border-zinc-200 border-t-amber-600 animate-spin dark:border-zinc-600 dark:border-t-amber-400`}
      aria-hidden
    />
  );

  if (decorative) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${className}`}
        aria-hidden
      >
        {ring}
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
    >
      {ring}
      <span className="sr-only">Loading</span>
    </span>
  );
}
