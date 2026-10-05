import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import type { PublicUser } from "@/types";

/**
 * GET /api/student/profile
 * Returns the current user's profile + stats.
 */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const userRecord = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!userRecord) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const completedAttempts = await db.quizAttempt.count({
    where: { userId: user.id, completedAt: { not: null } },
  });

  const avgScoreAgg = await db.quizAttempt.aggregate({
    where: { userId: user.id, completedAt: { not: null } },
    _avg: { scorePercentage: true },
  });

  const bestAttempt = await db.quizAttempt.findFirst({
    where: { userId: user.id, completedAt: { not: null } },
    orderBy: { scorePercentage: "desc" },
    select: { scorePercentage: true },
  });

  const profile: PublicUser = {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
    role: userRecord.role as "user" | "admin",
    createdAt: userRecord.createdAt.toISOString(),
  };

  return NextResponse.json({
    profile,
    stats: {
      quizzesCompleted: completedAttempts,
      avgScore: Math.round(avgScoreAgg._avg.scorePercentage ?? 0),
      bestScore: bestAttempt ? Math.round(bestAttempt.scorePercentage) : 0,
    },
  });
}

const UpdateSchema = z.object({
  name: z.string().min(1, "Name is required").max(80).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password must be at least 6 characters").optional(),
});

/**
 * PATCH /api/student/profile
 * Updates the user's name and/or password.
 * For password changes, requires currentPassword to be verified.
 */
export async function PATCH(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, currentPassword, newPassword } = parsed.data;
  const data: { name?: string; passwordHash?: string } = {};

  if (name !== undefined) {
    data.name = name.trim();
  }

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required to change password" },
        { status: 400 }
      );
    }

    const userRecord = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, userRecord.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return NextResponse.json({
    profile: {
      ...updated,
      role: updated.role as "user" | "admin",
      createdAt: updated.createdAt.toISOString(),
    },
  });
}
