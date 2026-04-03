"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useCenterToast } from "@/components/center-toast";
import { Spinner } from "@/components/spinner";

function parseContentDispositionFilename(cd: string | null): string | null {
  if (!cd) {
    return null;
  }
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* fall through */
    }
  }
  const quoted = cd.match(/filename="([^"]+)"/);
  return quoted?.[1] ?? null;
}

type Variant = "menu" | "inline";

export type ExcelExportTarget = "auto" | "finance" | "eod";

export function ExportExcelButton({
  variant = "inline",
  className = "",
  label = "Export Excel (.xlsx)",
  /** `auto`: EOD routes → EOD workbook; otherwise Finance workbook. */
  target = "auto",
}: {
  variant?: Variant;
  className?: string;
  label?: string;
  target?: ExcelExportTarget;
}) {
  const pathname = usePathname();
  const resolved = useMemo(() => {
    if (target === "eod") {
      return {
        url: "/api/eod/export/excel",
        fallbackFilename: "MIDAS_EODTracker_export.xlsx",
      };
    }
    if (target === "finance") {
      return {
        url: "/api/export/excel",
        fallbackFilename: "MIDAS_FinanceTracker_export.xlsx",
      };
    }
    const isEod = pathname?.startsWith("/eod-tracker") ?? false;
    return isEod
      ? {
          url: "/api/eod/export/excel",
          fallbackFilename: "MIDAS_EODTracker_export.xlsx",
        }
      : {
          url: "/api/export/excel",
          fallbackFilename: "MIDAS_FinanceTracker_export.xlsx",
        };
  }, [pathname, target]);

  const [busy, setBusy] = useState(false);
  const { showToast } = useCenterToast();

  async function onExport() {
    setBusy(true);
    try {
      const res = await fetch(resolved.url, {
        credentials: "same-origin",
      });
      if (res.status === 401) {
        showToast({
          kind: "error",
          title: "Sign in required",
          message: "Sign in to export.",
          timeoutMs: 4500,
        });
        return;
      }
      if (!res.ok) {
        showToast({
          kind: "error",
          title: "Export failed",
          message: "Try again in a moment.",
          timeoutMs: 4500,
        });
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const filename =
        parseContentDispositionFilename(cd) ?? resolved.fallbackFilename;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast({
        kind: "error",
        title: "Export failed",
        message: "Try again in a moment.",
        timeoutMs: 4500,
      });
    } finally {
      setBusy(false);
    }
  }

  const baseMenu =
    "flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 active:bg-zinc-200 disabled:opacity-50 sm:py-2 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700";
  const baseInline =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900";

  return (
    <span className={variant === "inline" ? "inline-flex" : ""}>
      <button
        type="button"
        role={variant === "menu" ? "menuitem" : undefined}
        disabled={busy}
        onClick={onExport}
        className={
          variant === "menu"
            ? `${baseMenu} ${className}`.trim()
            : `${baseInline} ${className}`.trim()
        }
      >
        {busy ? (
          <>
            <Spinner size="sm" decorative />
            Preparing…
          </>
        ) : (
          label
        )}
      </button>
    </span>
  );
}
