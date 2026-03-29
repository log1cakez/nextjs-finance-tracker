import { Spinner } from "@/components/spinner";

export default function Loading() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 backdrop-blur-md"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner size="lg" decorative />
      <p className="text-sm font-medium text-zinc-900 drop-shadow-sm dark:text-zinc-50">
        Loading…
      </p>
    </div>
  );
}
