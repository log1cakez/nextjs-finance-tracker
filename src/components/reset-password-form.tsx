"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import {
  resetPasswordWithOtp,
  type ResetPasswordState,
} from "@/app/actions/password-reset";
import { useToastOnActionError } from "@/components/center-toast";

const initial: ResetPasswordState = {};

export function ResetPasswordForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    resetPasswordWithOtp,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useToastOnActionError(state.error, pending, "Could not update password");

  useEffect(() => {
    if (state.success) {
      router.push("/login?reset=1");
    }
  }, [state.success, router]);

  useEffect(() => {
    if (state.error) {
      formRef.current?.querySelector<HTMLInputElement>('[name="otp"]')?.focus();
    }
  }, [state.error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        New password
      </h2>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Email
        <input
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          autoComplete="email"
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        6-digit code
        <input
          name="otp"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          autoComplete="one-time-code"
          placeholder="000000"
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/forgot-password"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
        >
          Request a new code
        </Link>
      </p>
    </form>
  );
}
