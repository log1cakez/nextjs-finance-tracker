"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import {
  requestPasswordResetOtp,
  type RequestOtpState,
} from "@/app/actions/password-reset";

const initial: RequestOtpState = {};

export function ForgotPasswordForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    requestPasswordResetOtp,
    initial,
  );
  const redirected = useRef(false);

  useEffect(() => {
    if (state.success && state.email && !redirected.current) {
      redirected.current = true;
      router.push(
        `/reset-password?email=${encodeURIComponent(state.email)}`,
      );
    }
  }, [state.success, state.email, router]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Reset by email
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        We’ll send a 6-digit code to your address. It expires in 15 minutes.
      </p>
      {state.error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{state.error}</p>
      ) : null}
      {state.success && !state.email ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          If an account with that email exists and uses a password, a code was
          sent. You can still{" "}
          <Link
            href="/reset-password"
            className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
          >
            enter a code
          </Link>{" "}
          if you already received one.
        </p>
      ) : null}
      {state.success && state.email ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Code sent — taking you to the next step…
        </p>
      ) : null}
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={pending || (state.success === true && !!state.email)}
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-zinc-400 focus:ring-2 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      <button
        type="submit"
        disabled={pending || (state.success === true && !!state.email)}
        className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Sending…" : "Send code"}
      </button>
    </form>
  );
}
