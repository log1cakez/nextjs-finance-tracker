"use client";

import { APP_AUTHOR_NAME, APP_FOOTER_DISCLAIMER } from "@/lib/brand";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-auto pt-8"
      role="contentinfo"
    >
      <div className="mx-auto max-w-5xl px-3 pb-2 text-center sm:px-6">
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          Created by {APP_AUTHOR_NAME}. © {year} {APP_AUTHOR_NAME}. All rights
          reserved.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
          {APP_FOOTER_DISCLAIMER}
        </p>
      </div>
    </footer>
  );
}
