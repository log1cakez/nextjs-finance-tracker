"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import {
  updateDisplayName,
  type UpdateNameState,
} from "@/app/actions/account-profile";

const initial: UpdateNameState = {};

export function UpdateNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateDisplayName,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  useEffect(() => {
    if (state.error) {
      formRef.current?.querySelector<HTMLInputElement>('[name="name"]')?.focus();
    }
  }, [state.error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Display name
      </h2>
      {state.success ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Name updated.
        </p>
      ) : null}
      {state.error && !state.success ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Name
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={initialName}
          autoComplete="name"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}
