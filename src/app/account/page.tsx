import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { ChangePasswordForm } from "@/components/change-password-form";
import { UpdateNameForm } from "@/components/update-name-form";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const db = getDb();
  const row = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { passwordHash: true, name: true },
  });
  const canChangePassword = Boolean(row?.passwordHash);
  const displayName = row?.name ?? session.user.name ?? "";

  return (
    <div className="mx-auto w-full max-w-md space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
          Account
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Signed in as{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {session.user.email}
          </span>
          .
        </p>
      </div>

      <UpdateNameForm initialName={displayName} />

      {canChangePassword ? (
        <ChangePasswordForm />
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
          Password sign-in is not enabled for this account (for example, you
          may use Google). Password changes apply only to email login.
        </div>
      )}

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
        >
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
