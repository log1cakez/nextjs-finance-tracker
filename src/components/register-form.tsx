"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { registerUser, type RegisterState } from "@/app/actions/register";
import {
  useCenterToast,
  useToastOnActionError,
} from "@/components/center-toast";
import { formatTypedLabel } from "@/lib/typed-label-format";

const initial: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerUser, initial);
  const { showToast } = useCenterToast();
  const formRef = useRef<HTMLFormElement>(null);

  useToastOnActionError(state.error, pending, "Could not create account");

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      showToast({
        kind: "success",
        title: "Account created",
        message: "You can sign in now.",
        timeoutMs: 2600,
      });
    }
  }, [state.success, showToast]);

  if (state.success) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
        <Link
          href="/login"
          className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Create account
      </h2>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Name (optional)
        <input
          name="name"
          type="text"
          autoComplete="name"
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          placeholder="Your name"
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v) e.currentTarget.value = formatTypedLabel(v);
          }}
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
        <span className="mt-1 block text-xs text-zinc-500">
          At least 8 characters
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
