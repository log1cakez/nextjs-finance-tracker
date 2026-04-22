"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type ToastKind = "success" | "error" | "info";

type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  timeoutMs: number;
};

type ToastApi = {
  showToast: (t: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
let warnedMissingProvider = false;

const noopToastApi: ToastApi = {
  showToast: () => {
    // no-op when provider is unavailable during render boundaries
  },
};

export function useCenterToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    if (!warnedMissingProvider && typeof window !== "undefined") {
      warnedMissingProvider = true;
      // eslint-disable-next-line no-console
      console.warn("CenterToastProvider missing in tree; toasts are disabled for this render.");
    }
    return noopToastApi;
  }
  return ctx;
}

export function CenterToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const showToast = useCallback(
    (t: Omit<Toast, "id">) => {
      clearTimer();
      const next: Toast = {
        ...t,
        id: crypto.randomUUID(),
        timeoutMs: Math.max(900, Math.min(10_000, t.timeoutMs)),
      };
      setToast(next);
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, next.timeoutMs);
    },
    [clearTimer],
  );

  const api = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted && toast
        ? createPortal(
            <div
              className="fixed inset-0 z-[300] flex items-center justify-center px-4"
              role="dialog"
              aria-modal="false"
              aria-live="polite"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={
                        toast.kind === "success"
                          ? "text-sm font-semibold text-emerald-700 dark:text-emerald-400"
                          : toast.kind === "error"
                            ? "text-sm font-semibold text-rose-700 dark:text-rose-400"
                            : "text-sm font-semibold text-zinc-800 dark:text-zinc-200"
                      }
                    >
                      {toast.title}
                    </p>
                    {toast.message ? (
                      <p className="mt-1 break-words text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {toast.message}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    aria-label="Close"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

/** When a server action finishes (`pending` → false), show `error` in a toast (if any). */
export function useToastOnActionError(
  error: string | undefined,
  pending: boolean,
  title = "Something went wrong",
  timeoutMs = 5200,
) {
  const { showToast } = useCenterToast();
  const prevPendingRef = useRef(pending);
  useEffect(() => {
    const actionJustFinished = prevPendingRef.current && !pending;
    prevPendingRef.current = pending;
    if (actionJustFinished && error) {
      showToast({
        kind: "error",
        title,
        message: error,
        timeoutMs,
      });
    }
  }, [pending, error, showToast, title, timeoutMs]);
}
