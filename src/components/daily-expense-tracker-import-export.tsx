"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";
import { useCenterToast } from "@/components/center-toast";

function parseContentDispositionFilename(cd: string | null): string | null {
  if (!cd) return null;
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* fall through */
    }
  }
  return cd.match(/filename="([^"]+)"/)?.[1] ?? null;
}

export function DailyExpenseTrackerImportExport() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { showToast } = useCenterToast();

  async function downloadTemplate() {
    setExporting(true);
    try {
      const res = await fetch("/api/daily-expense-tracker/template", {
        credentials: "same-origin",
      });
      if (!res.ok) {
        showToast({
          kind: "error",
          title: "Could not generate tracker",
          message: res.status === 401 ? "Sign in required." : "Try again in a moment.",
          timeoutMs: 4500,
        });
        return;
      }
      const blob = await res.blob();
      const filename =
        parseContentDispositionFilename(res.headers.get("Content-Disposition")) ??
        "MIDAS_Daily_Expense_Tracker.xlsx";
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
        title: "Could not generate tracker",
        message: "Try again in a moment.",
        timeoutMs: 4500,
      });
    } finally {
      setExporting(false);
    }
  }

  async function importFile(file: File) {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/daily-expense-tracker/import", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => null)) as
        | {
            imported?: number;
            skipped?: number;
            error?: string;
            details?: string[];
            totalErrors?: number;
          }
        | null;

      if (!res.ok) {
        const details = data?.details?.slice(0, 3).join(" ");
        const more =
          data?.totalErrors && data.totalErrors > 3
            ? ` ${data.totalErrors - 3} more issue(s).`
            : "";
        showToast({
          kind: "error",
          title: data?.error ?? "Import failed",
          message: details ? `${details}${more}` : "Check the file and try again.",
          timeoutMs: 9000,
        });
        return;
      }

      showToast({
        kind: "success",
        title: "Tracker imported",
        message: `${data?.imported ?? 0} added, ${data?.skipped ?? 0} skipped as duplicates.`,
        timeoutMs: 4500,
      });
      router.refresh();
    } catch {
      showToast({
        kind: "error",
        title: "Import failed",
        message: "Check the file and try again.",
        timeoutMs: 4500,
      });
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Daily expense tracker
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Generate a dated weekly workbook using your expense categories and
            accounts, then import it to add filled rows as transactions.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={exporting || importing}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {exporting ? <Spinner size="sm" decorative /> : null}
            {exporting ? "Generating..." : "Generate tracker"}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={exporting || importing}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {importing ? <Spinner size="sm" decorative /> : null}
            {importing ? "Importing..." : "Import filled tracker"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void importFile(file);
            }}
          />
        </div>
      </div>
    </section>
  );
}
