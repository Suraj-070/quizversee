import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/users
 *
 * Returns all users with summary stats:
 *   - role, name, email, createdAt
 *   - totalAttempts (completed only)
 *   - averageScore
 *   - lastActiveAt
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  const stats = await Promise.all(
    users.map(async (u) => {
      const attempts = await db.quizAttempt.findMany({
        where: { userId: u.id, completedAt: { not: null } },
        select: { scorePercentage: true, completedAt: true },
      });
      const totalAttempts = attempts.length;
      const avgScore =
        totalAttempts > 0
          ? attempts.reduce((sum, a) => sum + a.scorePercentage, 0) /
            totalAttempts
          : 0;
      const lastActiveAt =
        attempts.length > 0
          ? attempts
              .map((a) => a.completedAt!)
              .sort((a, b) => b.getTime() - a.getTime())[0]
          : null;
      return { totalAttempts, avgScore, lastActiveAt };
    })
  );

  const result = users.map((u, idx) => ({
    ...u,
    ...stats[idx],
  }));

  return NextResponse.json({ users: result });
}
