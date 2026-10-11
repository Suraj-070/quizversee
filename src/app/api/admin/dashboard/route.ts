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

  // Published Nepal curriculum coverage, computed from the existing question bank.
  // The 40-question benchmark is guidance only; no content is modified.
  const curriculumTopics = await db.topic.findMany({
    where: {
      isActive: true,
      archivedAt: null,
      contentType: "curriculum",
      subject: {
        isActive: true,
        archivedAt: null,
        class: { isActive: true, archivedAt: null },
      },
    },
    select: {
      id: true,
      name: true,
      subject: {
        select: { name: true, class: { select: { name: true } } },
      },
      _count: {
        select: {
          questions: {
            where: { status: "published", archivedAt: null, contentType: "curriculum" },
          },
        },
      },
    },
  });
  const coverageTopics = curriculumTopics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    subjectName: topic.subject.name,
    className: topic.subject.class.name,
    publishedQuestions: topic._count.questions,
  })).sort((a, b) => a.publishedQuestions - b.publishedQuestions || a.name.localeCompare(b.name));

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
    curriculumCoverage: {
      topicCount: coverageTopics.length,
      under40Count: coverageTopics.filter((topic) => topic.publishedQuestions < 40).length,
      priorityTopics: coverageTopics.filter((topic) => topic.publishedQuestions < 40).slice(0, 8),
    },
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      description: a.description,
      action: a.action,
      createdAt: a.createdAt.toISOString(),
      adminName: a.admin?.name ?? null,
    })),
  });
}
