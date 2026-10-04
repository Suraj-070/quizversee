import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

/**
 * NextAuth configuration for the MCQ platform.
 *
 * - Uses the Credentials provider (email + password).
 * - Passwords are hashed with bcrypt.
 * - The user's `role` ("user" | "admin") is attached to the JWT and exposed
 *   via the session callback so the client can branch UI.
 * - The real authorization enforcement happens server-side via
 *   `requireUser()` / `requireAdmin()` in `lib/auth-guard.ts`. Client role
 *   checks here are UX-only.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.toLowerCase().trim();
        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        } as { id: string; email: string; name: string; role: string };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    // We don't use server-rendered auth pages; the AppShell handles the
    // login/register UI client-side. This is here for completeness.
    signIn: "/?view=login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * Convenience type for a session user that includes the role field.
 */
export type AppSessionUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
};
