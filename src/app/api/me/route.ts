import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-guard";
import type { PublicUser } from "@/types";

/**
 * GET /api/me
 * Returns the currently authenticated user's public profile + academic profile.
 * Used by the AppShell on initial load to hydrate the client and decide
 * whether to show onboarding.
 */
export async function GET() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const userRecord = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      onboardingCompleted: true,
      currentClassId: true,
    },
  });

  if (!userRecord) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const user: PublicUser & {
    onboardingCompleted: boolean;
    currentClassId: string | null;
  } = {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
    role: userRecord.role as "user" | "admin",
    createdAt: userRecord.createdAt.toISOString(),
    onboardingCompleted: userRecord.onboardingCompleted,
    currentClassId: userRecord.currentClassId,
  };

  return NextResponse.json({ user });
}
