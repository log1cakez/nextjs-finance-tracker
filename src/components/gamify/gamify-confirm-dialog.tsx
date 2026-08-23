"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function GamifyConfirmDialog({
  title = "CONFIRM",
  message,
  confirmLabel = "DELETE",
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  if (!mounted) return null;

  const portalTarget = document.getElementById("gamify-portal-root") ?? document.body;

  return createPortal(
    <div
      className="gamify-confirm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="pixel-panel pixel-corners w-full max-w-sm bg-[var(--gb-panel)] p-5 text-[var(--gb-text)]">
        <h2 className="pixel-font text-xs text-[var(--gb-yellow)]">{title}</h2>
        <p className="mt-4 text-sm leading-relaxed">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="pixel-btn pixel-corners-sm px-3 py-2 text-[10px]"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="pixel-font pixel-btn pixel-corners-sm px-4 py-2 text-[10px] text-[var(--gb-magenta)]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
