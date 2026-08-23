"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { UpdateNameForm } from "@/components/update-name-form";

export function AccountSettingsModal({
  displayName,
  email,
  canChangePassword,
  onClose,
}: {
  displayName: string;
  email?: string | null;
  canChangePassword: boolean;
  onClose: () => void;
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

  return createPortal(
    <div
      className="fixed inset-0 z-[250] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Account</h2>
            <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
              Signed in as{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{email}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <UpdateNameForm initialName={displayName} />

        {canChangePassword ? (
          <ChangePasswordForm />
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
            Password sign-in is not enabled for this account (for example, you
            may use Google). Password changes apply only to email login.
          </div>
        )}

        {canChangePassword ? (
          <DeleteAccountForm />
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
            <h2 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Delete account
            </h2>
            <p className="leading-relaxed">
              Accounts without a password (for example, Google-only sign-in)
              cannot be deleted from this screen. Add email and password login
              first, or contact support if you need the account removed.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
