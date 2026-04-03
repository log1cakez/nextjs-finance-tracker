import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/apps");
  }

  const { email } = await searchParams;
  const defaultEmail = typeof email === "string" ? email.trim() : "";

  return (
    <div className="mx-auto w-full max-w-md space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Reset password
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Use the code from your email, then choose a new password.
        </p>
      </div>
      <ResetPasswordForm defaultEmail={defaultEmail} />
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
