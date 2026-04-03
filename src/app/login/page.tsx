import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthPageLogo } from "@/components/auth-page-logo";
import { LoginForm } from "@/components/login-form";
import { LoginFlashToasts } from "@/components/server-flash-toast";
import { APP_TAGLINE } from "@/lib/brand";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; deleted?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  const { reset, deleted } = await searchParams;
  const passwordResetOk = reset === "1";
  const accountDeleted = deleted === "1";

  const showGoogle =
    !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 sm:space-y-8">
      <AuthPageLogo />
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Sign in
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {APP_TAGLINE}
        </p>
      </div>
      <LoginFlashToasts
        accountDeleted={accountDeleted}
        passwordResetOk={passwordResetOk}
      />
      <LoginForm showGoogle={showGoogle} />
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        No account?{" "}
        <Link
          href="/register"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
