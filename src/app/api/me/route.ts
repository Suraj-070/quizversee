import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { PublicUser } from "@/types";

/**
 * GET /api/me
 * Returns the currently authenticated user's public profile.
 * Used by the AppShell on initial load to hydrate the client.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const userRecord = await db.user.findUnique({
    where: { id: (session.user as { id: string }).id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  if (!userRecord) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const user: PublicUser = {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
    role: userRecord.role as "user" | "admin",
    createdAt: userRecord.createdAt.toISOString(),
  };

  return NextResponse.json({ user });
}
