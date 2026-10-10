import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/student/progress
 *
 * Returns the student's progress aggregated by subject → topic:
 *   - quizzesCompleted (total)
 *   - averageScore (overall)
 *   - bestScore (overall)
 *   - per-topic: best score, attempts count, last attempt date
 */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  // Fetch all completed attempts with their topic/subject chain
  const attempts = await db.quizAttempt.findMany({
    where: { userId: user.id, completedAt: { not: null } },
    include: {
      topic: {
        select: {
          id: true, name: true,
          subject: {
            select: {
              id: true, name: true,
              class: { select: { id: true, name: true } },
            },
          },
        },
      },
      subject: {
        select: {
          id: true, name: true,
          class: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  const quizzesCompleted = attempts.length;
  const avgScore = quizzesCompleted > 0
    ? Math.round(attempts.reduce((s, a) => s + a.scorePercentage, 0) / quizzesCompleted)
    : 0;
  const bestScore = quizzesCompleted > 0
    ? Math.round(Math.max(...attempts.map((a) => a.scorePercentage)))
    : 0;

  // Group by topic
  const topicMap = new Map<string, {
    topicId: string;
    topicName: string;
    subjectId: string;
    subjectName: string;
    classId: string;
    className: string;
    attempts: number;
    bestScore: number;
    avgScore: number;
    lastAttemptDate: string;
  }>();

  for (const a of attempts) {
    const topicId = a.topicId ?? a.subject?.id ?? "unknown";
    const topicName = a.topic?.name ?? (a.subject ? `${a.subject.name} (Subject Exam)` : "Quiz");
    const subjectId = a.topic?.subject.id ?? a.subject?.id ?? "unknown";
    const subjectName = a.topic?.subject.name ?? a.subject?.name ?? "";
    const classId = a.topic?.subject.class.id ?? a.subject?.class.id ?? "";
    const className = a.topic?.subject.class.name ?? a.subject?.class.name ?? "";

    const existing = topicMap.get(topicId);
    if (existing) {
      existing.attempts++;
      existing.bestScore = Math.max(existing.bestScore, Math.round(a.scorePercentage));
      existing.lastAttemptDate = a.completedAt!.toISOString();
    } else {
      topicMap.set(topicId, {
        topicId, topicName, subjectId, subjectName, classId, className,
        attempts: 1,
        bestScore: Math.round(a.scorePercentage),
        avgScore: Math.round(a.scorePercentage),
        lastAttemptDate: a.completedAt!.toISOString(),
      });
    }
  }

  // Compute avg per topic
  for (const [id, t] of topicMap) {
    const topicAttempts = attempts.filter(
      (a) => (a.topicId ?? a.subject?.id) === id
    );
    t.avgScore = Math.round(
      topicAttempts.reduce((s, a) => s + a.scorePercentage, 0) / topicAttempts.length
    );
  }

  // Group by subject
  const subjectMap = new Map<string, {
    subjectId: string;
    subjectName: string;
    classId: string;
    className: string;
    topics: Array<typeof topicMap extends Map<string, infer V> ? V : never>;
  }>();

  for (const [, t] of topicMap) {
    if (!subjectMap.has(t.subjectId)) {
      subjectMap.set(t.subjectId, {
        subjectId: t.subjectId,
        subjectName: t.subjectName,
        classId: t.classId,
        className: t.className,
        topics: [],
      });
    }
    subjectMap.get(t.subjectId)!.topics.push(t);
  }

  // Recently practiced (last 5)
  const recentlyPracticed = attempts.slice(0, 5).map((a) => ({
    attemptId: a.id,
    topicName: a.topic?.name ?? a.subject?.name ?? "Quiz",
    subjectName: a.topic?.subject.name ?? a.subject?.name ?? "",
    score: a.correctAnswers,
    total: a.totalQuestions,
    percentage: Math.round(a.scorePercentage),
    date: a.completedAt!.toISOString(),
  }));

  return NextResponse.json({
    overview: { quizzesCompleted, avgScore, bestScore },
    subjects: Array.from(subjectMap.values()),
    recentlyPracticed,
  });
}
