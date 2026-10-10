import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/dashboard
 *
 * Returns aggregate counts for the admin dashboard summary cards.
 * Requires admin role.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [
  classes,
  subjects,
  topics,
  questions,
  publishedQuestions,
  draftQuestions,
  users,
  quizAttempts,
  quizAttemptsToday,
  quizSets,
  publishedQuizSets,
] = await Promise.all([
    db.class.count(),
    db.subject.count(),
    db.topic.count(),
    db.question.count(),
    db.question.count({ where: { status: "published" } }),
    db.question.count({ where: { status: "draft" } }),
    db.user.count(),
    db.quizAttempt.count(),
    db.quizAttempt.count({
      where: {
        completedAt: { not: null },
        startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    db.quizSet.count(),
    db.quizSet.count({ where: { status: "published" } }),
  ]);

  // Fetch recent activity (last 10)
  const recentActivity = await db.adminActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      description: true,
      action: true,
      createdAt: true,
      admin: { select: { name: true } },
    },
  });

  // Average score
  const avgScoreAgg = await db.quizAttempt.aggregate({
    where: { completedAt: { not: null } },
    _avg: { scorePercentage: true },
  });

  return NextResponse.json({
    classes,
    subjects,
    topics,
    questions,
    publishedQuestions,
    draftQuestions,
    users,
    quizAttempts,
    quizAttemptsToday,
    quizSets,
    publishedQuizSets,
    avgScore: Math.round(avgScoreAgg._avg.scorePercentage ?? 0),
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      description: a.description,
      action: a.action,
      createdAt: a.createdAt.toISOString(),
      adminName: a.admin?.name ?? null,
    })),
  });
}
