import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/apps");
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Forgot password
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Enter your email and we’ll send a one-time code.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
