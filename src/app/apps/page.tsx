import Image from "next/image";
import Link from "next/link";

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
    <main className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="w-full max-w-4xl px-4 space-y-8">
        <div className="text-center space-y-6">
          <div className="flex justify-center px-1">
            <Image
              src="/butateng.jpg"
              alt="Profile photo"
              width={960}
              height={960}
              priority
              sizes="(max-width: 768px) 94vw, 42rem"
              className="aspect-square w-full max-w-[min(94vw,42rem)] rounded-3xl border-2 border-zinc-200/90 object-cover shadow-lg dark:border-zinc-600"
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Choose an app</h1>
            <p className="text-sm text-muted-foreground">
              Pick which experience you want to use after signing in.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {apps.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="block min-h-[4.25rem] touch-manipulation rounded-lg border p-4 transition-colors active:bg-muted/80 hover:bg-muted"
            >
              <h2 className="font-medium mb-1">{app.title}</h2>
              <p className="text-sm text-muted-foreground">{app.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

