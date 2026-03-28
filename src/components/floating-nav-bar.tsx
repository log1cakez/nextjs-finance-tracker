"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function FloatingNavBar({
  items,
}: {
  items: readonly { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pt-2 sm:px-4"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
      }}
      aria-label="Main navigation"
    >
      <div className="pointer-events-auto flex max-w-[min(100%,42rem)] touch-pan-x overflow-x-auto rounded-2xl border border-zinc-200/90 bg-white/95 px-1 py-1.5 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.08),0_8px_32px_-8px_rgba(0,0,0,0.12)] backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] dark:border-zinc-700/90 dark:bg-zinc-950/95 dark:shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.4),0_8px_32px_-8px_rgba(0,0,0,0.5)] sm:px-1.5 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.href === "/" ? false : undefined}
              className={`shrink-0 whitespace-nowrap rounded-xl px-2.5 py-2.5 text-xs font-medium transition-colors min-[400px]:px-3 min-[400px]:text-sm sm:py-2 ${
                active
                  ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md shadow-amber-900/25 dark:from-amber-500 dark:to-amber-600 dark:text-zinc-950 dark:shadow-amber-950/35"
                  : "text-zinc-600 hover:bg-amber-500/10 hover:text-amber-900 dark:text-zinc-400 dark:hover:bg-amber-500/10 dark:hover:text-amber-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
