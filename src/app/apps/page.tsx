import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const apps = [
  {
    href: "/financetracker",
    title: "Finance Tracker",
    description: "Track income, expenses, budgets, and reports.",
  },
  {
    href: "/eod-tracker",
    title: "EOD Tracker",
    description: "Log end-of-day entries and link out to Notion pages.",
  },
];

export default function AppPickerPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-4">
      <div className="w-full max-w-4xl space-y-8 px-4">
        <div className="flex justify-center px-1">
          <BrandMark variant="stacked" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {apps.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="block min-h-[4.25rem] touch-manipulation rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-100 active:bg-zinc-100/80 dark:border-zinc-800 dark:hover:bg-zinc-900/60 dark:active:bg-zinc-900/80"
            >
              <h2 className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">{app.title}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{app.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
