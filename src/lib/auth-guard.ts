import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { type AppSessionUser } from "@/lib/auth";

/**
 * Server-side authorization helpers.
 *
 * The sandbox doesn't have Supabase RLS, so all authorization is enforced
 * here, inside every Route Handler. Client-side role checks are UX-only.
 *
 * In Next.js 16 App Router, `getServerSession(authOptions)` and `getToken`
 * from `next-auth/jwt` both fail to read cookies from Route Handlers
 * (known NextAuth v4 + Next.js 16 incompatibility). Instead, we fetch the
 * session from NextAuth's own session endpoint (`/api/auth/session`) with
 * the cookie header forwarded — that endpoint works because it's the
 * NextAuth handler itself.
 *
 * Usage:
 *   const { user, error } = await requireUser();
 *   if (error) return error;
 */

export type AuthResult =
  | { user: AppSessionUser; error: null }
  | { user: null; error: NextResponse };

/**
 * Fetches the session by calling /api/auth/session with the request's
 * cookie header. This is the most reliable way to read the NextAuth
 * session in Next.js 16 App Router Route Handlers.
 */
async function getSessionUser(): Promise<AppSessionUser | null> {
  const h = await headers();
  const cookieHeader = h.get("cookie") || "";

  // Auto-detect the base URL from the request's host header, falling back
  // to NEXTAUTH_URL env var, then localhost. This works in both dev and
  // production without hardcoding.
  const host = h.get("host");
  const protocol = h.get("x-forwarded-proto") || "http";
  const baseUrl = host
    ? `${protocol}://${host}`
    : process.env.NEXTAUTH_URL || "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const session = (await res.json()) as {
    user?: { id?: string; email?: string; name?: string; role?: string };
  };
  if (!session.user?.id) return null;

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: (session.user.role as "user" | "admin") ?? "user",
  };
}

/**
 * Returns the authenticated user, or a 401 NextResponse if not logged in.
 */
export async function requireUser(): Promise<AuthResult> {
  const user = await getSessionUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  return { user, error: null };
}

/**
 * Returns the authenticated admin user, or:
 *   - 401 if not logged in
 *   - 403 if logged in but not an admin
 */
export async function requireAdmin(): Promise<AuthResult> {
  const { user, error } = await requireUser();
  if (error) return { user: null, error };

  if (user.role !== "admin") {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return { user, error: null };
}

/**
 * Helper that fetches the session user.
 * Used by /api/me and other routes that need the current user.
 */
export async function getCurrentUser(): Promise<AppSessionUser | null> {
  return getSessionUser();
}
