"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function RetroModal({
  title,
  onClose,
  children,
  widthClassName = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  // Portal into the gamify theme root (not document.body) so the modal still
  // sees the --gb-* CSS variables, which only cascade within `.gamify-root`.
  const portalTarget = document.getElementById("gamify-portal-root") ?? document.body;

  return createPortal(
    <div
      className="gamify-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`pixel-panel pixel-corners w-full ${widthClassName} bg-[var(--gb-panel)] p-5 text-[var(--gb-text)]`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="pixel-font text-xs text-[var(--gb-yellow)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="pixel-btn pixel-corners-sm flex h-8 w-8 items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    portalTarget,
  );
}
