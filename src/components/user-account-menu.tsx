"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/auth";
import { ExportExcelButton } from "@/components/export-excel-button";

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function UserAccountMenu({
  displayName,
  email,
}: {
  displayName: string;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        className="flex max-w-full min-h-10 items-center justify-end gap-1 rounded-lg py-2 pl-2 pr-1.5 text-end text-sm text-zinc-600 transition-colors hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:active:bg-zinc-800"
        aria-expanded={open}
        aria-haspopup="menu"
        title={email ?? undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="max-w-[min(12rem,55vw)] truncate sm:max-w-[220px]">
          {displayName}
        </span>
        <ChevronDown open={open} />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 max-w-[min(18rem,calc(100vw-1.5rem))] min-w-[12rem] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          role="menu"
        >
          <Link
            href="/apps"
            role="menuitem"
            className="block px-3 py-3 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 active:bg-zinc-200 sm:py-2 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
            onClick={() => setOpen(false)}
          >
            App dashboard
          </Link>
          <Link
            href="/financetracker/account"
            role="menuitem"
            className="block px-3 py-3 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 active:bg-zinc-200 sm:py-2 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
            onClick={() => setOpen(false)}
          >
            Account
          </Link>
          <ExportExcelButton variant="menu" />
          <form action={signOutAction} className="border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="submit"
              role="menuitem"
              className="w-full px-3 py-3 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 active:bg-zinc-200 sm:py-2 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
