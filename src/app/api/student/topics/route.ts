import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/student/topics?subjectId=<id>
 *
 * Returns active topics for a given subject, with:
 *   - published-question count per topic
 *   - the user's last quiz attempt score per topic (best-effort)
 */
export async function GET(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json(
      { error: "subjectId is required" },
      { status: 400 }
    );
  }

  // Verify the subject is active
  const subject = await db.subject.findFirst({
    where: { id: subjectId, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      class: { select: { id: true, name: true } },
    },
  });
  if (!subject) {
    return NextResponse.json(
      { error: "Subject not found or not available" },
      { status: 404 }
    );
  }

  const topics = await db.topic.findMany({
    where: { subjectId, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      displayOrder: true,
    },
  });

  // For each topic, fetch the published-question count and the user's
  // most recent completed attempt (if any).
  const topicsWithStats = await Promise.all(
    topics.map(async (t) => {
      const [publishedQuestions, lastAttempt] = await Promise.all([
        db.question.count({
          where: { topicId: t.id, status: "published" },
        }),
        db.quizAttempt.findFirst({
          where: {
            userId: user.id,
            topicId: t.id,
            completedAt: { not: null },
          },
          orderBy: { completedAt: "desc" },
          select: {
            id: true,
            totalQuestions: true,
            correctAnswers: true,
            scorePercentage: true,
            completedAt: true,
          },
        }),
      ]);
      return { ...t, publishedQuestions, lastAttempt };
    })
  );

  return NextResponse.json({ subject, topics: topicsWithStats });
}
