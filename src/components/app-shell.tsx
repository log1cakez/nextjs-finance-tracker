"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { EodSectionNav } from "@/components/eod/eod-section-nav";
import { FloatingNavBar } from "@/components/floating-nav-bar";
import { NavbarPreferences } from "@/components/navbar-preferences";
import { SiteFooter } from "@/components/site-footer";
import { UserAccountMenu } from "@/components/user-account-menu";
import type { FiatCurrency } from "@/lib/money";

const HIDE_HEADER_PATHS = new Set(["/login", "/register", "/apps"]);

export const mainNav = [
  { href: "/financetracker", label: "Dashboard" },
  { href: "/financetracker/transactions", label: "Transactions" },
  { href: "/financetracker/accounts", label: "Accounts" },
  { href: "/financetracker/transfers", label: "Transfers" },
  { href: "/financetracker/lending", label: "Lending" },
  { href: "/financetracker/recurring", label: "Recurring" },
  { href: "/financetracker/categories", label: "Categories" },
] as const;

export function AppShell({
  children,
  user,
  preferredCurrency,
}: {
  children: React.ReactNode;
  user: { email?: string | null; name?: string | null } | null;
  preferredCurrency: FiatCurrency;
}) {
  const pathname = usePathname();
  const hideHeader = pathname ? HIDE_HEADER_PATHS.has(pathname) : false;
  const wideContent = pathname?.startsWith("/eod-tracker") ?? false;
  const financetrackerNavPad =
    Boolean(user) && (pathname?.startsWith("/financetracker") ?? false);
  const eodFloatingNavPad =
    Boolean(user) && (pathname?.startsWith("/eod-tracker") ?? false);
  const bottomFloatingNavPad = financetrackerNavPad || eodFloatingNavPad;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {hideHeader ? (
        <div
          className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex max-w-[calc(100vw-1.5rem)] flex-row flex-wrap items-center justify-end gap-2 sm:right-4 sm:top-4 sm:max-w-none sm:gap-3"
          aria-label={user ? "Account and display preferences" : "Display preferences"}
        >
          {user ? (
            <UserAccountMenu
              displayName={user.name || user.email || "Account"}
              email={user.email}
            />
          ) : null}
          <NavbarPreferences initialCurrency={preferredCurrency} />
        </div>
      ) : (
        <header className="border-b border-zinc-200/80 bg-gradient-to-b from-amber-500/[0.06] to-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md dark:border-zinc-800 dark:from-amber-500/[0.08] dark:to-zinc-950/90">
          <div
            className={`mx-auto flex w-full min-w-0 flex-col gap-3 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4 ${wideContent ? "max-w-none" : "max-w-5xl"}`}
          >
            <Link
              href={user ? "/apps" : "/login"}
              className="flex min-h-16 min-w-0 w-full shrink-0 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 sm:min-h-[4.5rem] sm:w-auto sm:shrink-0 sm:justify-start sm:self-auto"
            >
              <BrandMark />
            </Link>
            <div
              className={
                user
                  ? "flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-2"
                  : "flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-2"
              }
            >
              {!user ? (
                <>
                  <Link
                    href="/login"
                    className="inline-flex min-h-10 min-w-[2.75rem] items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 dark:active:bg-zinc-800"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex min-h-10 min-w-[2.75rem] items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 dark:active:bg-zinc-800"
                  >
                    Register
                  </Link>
                </>
              ) : null}
              {user ? (
                <UserAccountMenu
                  displayName={user.name || user.email || "Account"}
                  email={user.email}
                />
              ) : null}
              <NavbarPreferences initialCurrency={preferredCurrency} />
            </div>
          </div>
        </header>
      )}
      <main
        className={`mx-auto flex w-full min-h-0 min-w-0 flex-1 flex-col px-3 py-6 sm:px-6 sm:py-8 ${wideContent ? "max-w-none" : "max-w-5xl"} ${hideHeader ? "pt-10 sm:pt-12" : ""} ${
          bottomFloatingNavPad
            ? "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]"
            : "pb-[env(safe-area-inset-bottom,0px)]"
        }`}
      >
        {children}
        <SiteFooter />
      </main>
      {user && pathname?.startsWith("/financetracker") ? (
        <FloatingNavBar items={mainNav} />
      ) : null}
      {user && pathname?.startsWith("/eod-tracker") ? <EodSectionNav /> : null}
    </div>
  );
}
