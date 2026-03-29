"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  deleteAccount,
  type DeleteAccountState,
} from "@/app/actions/delete-account";

const initial: DeleteAccountState = {};

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccount, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) {
      formRef.current
        ?.querySelector<HTMLInputElement>('[name="password"]')
        ?.focus();
    }
  }, [state.error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/50 dark:bg-zinc-950/50"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Delete account
      </h2>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Permanently remove your profile and all associated data (transactions,
        accounts, categories, recurring items, lending records, and transfers).
        This cannot be undone.
      </p>
      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Type your password to confirm
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60 dark:border-red-500 dark:bg-red-600 dark:hover:bg-red-500"
      >
        {pending ? "Deleting…" : "Delete my account permanently"}
      </button>
    </form>
  );
}
