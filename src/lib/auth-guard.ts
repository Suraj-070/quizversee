import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions, type AppSessionUser } from "@/lib/auth";

/**
 * Server-side authorization helpers.
 *
 * The sandbox doesn't have Supabase RLS, so all authorization is enforced
 * here, inside every Route Handler. Client-side role checks are UX-only.
 *
 * Usage:
 *   const { user, error } = await requireUser();
 *   if (error) return error;
 */

export type AuthResult =
  | { user: AppSessionUser; error: null }
  | { user: null; error: NextResponse };

/**
 * Returns the authenticated user, or a 401 NextResponse if not logged in.
 */
export async function requireUser(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  const user = session.user as AppSessionUser;
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
