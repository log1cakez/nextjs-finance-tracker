import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthPageLogo } from "@/components/auth-page-logo";
import { AuthPageQuote } from "@/components/auth-page-quote";
import { RegisterForm } from "@/components/register-form";
import { REGISTER_INTRO } from "@/lib/brand";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 sm:space-y-8">
      <AuthPageLogo />
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Register
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {REGISTER_INTRO}
        </p>
      </div>
      <RegisterForm />
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
        >
          Sign in
        </Link>
      </p>
      <AuthPageQuote />
    </div>
  );
}
