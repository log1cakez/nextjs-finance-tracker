"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  changePassword,
  type ChangePasswordState,
} from "@/app/actions/change-password";
import {
  useCenterToast,
  useToastOnActionError,
} from "@/components/center-toast";

const initial: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initial,
  );
  const { showToast } = useCenterToast();
  const formRef = useRef<HTMLFormElement>(null);

  useToastOnActionError(state.error, pending, "Could not update password");

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      showToast({
        kind: "success",
        title: "Password updated",
        timeoutMs: 2200,
      });
    }
  }, [state.success, showToast]);

  useEffect(() => {
    if (state.error) {
      formRef.current
        ?.querySelector<HTMLInputElement>('[name="currentPassword"]')
        ?.focus();
    }
  }, [state.error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Change password
      </h2>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Current password
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        New password
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
