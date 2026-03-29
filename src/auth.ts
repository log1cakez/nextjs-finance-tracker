import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  accounts,
  authenticators,
  users,
  verificationTokens,
} from "@/db/schema";

const db = getDb();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const email = String(credentials.email).toLowerCase().trim();
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        if (!user?.passwordHash) {
          return null;
        }
        const ok = await bcrypt.compare(
          String(credentials.password),
          user.passwordHash,
        );
        if (!ok) {
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [Google({})]
      : []),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const p = request.nextUrl.pathname;
      if (p.startsWith("/api/auth")) {
        return true;
      }
      if (p.startsWith("/api/export/")) {
        return true;
      }
      if (
        auth?.user &&
        (p === "/login" ||
          p === "/register" ||
          p === "/forgot-password" ||
          p === "/reset-password")
      ) {
        return NextResponse.redirect(new URL("/", request.nextUrl));
      }
      if (
        p === "/login" ||
        p === "/register" ||
        p === "/forgot-password" ||
        p === "/reset-password"
      ) {
        return true;
      }
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        if (user.email) {
          token.email = user.email;
        }
        if (user.name !== undefined) {
          token.name = user.name;
        }
        if (user.image !== undefined) {
          token.picture = user.image;
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      const id =
        typeof token.id === "string"
          ? token.id
          : typeof token.sub === "string"
            ? token.sub
            : "";
      session.user.id = id;
      if (token.email) {
        session.user.email = token.email as string;
      }
      if (token.name !== undefined) {
        session.user.name = token.name as string | null;
      }
      if (token.picture !== undefined) {
        session.user.image = token.picture as string | null;
      }
      if (id) {
        const row = await db.query.users.findFirst({
          where: eq(users.id, id),
          columns: { email: true, name: true, image: true },
        });
        if (row) {
          session.user.email = row.email;
          session.user.name = row.name;
          session.user.image = row.image;
        }
      }
      return session;
    },
  },
  trustHost: true,
});
