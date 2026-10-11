import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/analytics
 *
 * Returns simple analytics computed from real quiz attempt + user answer data:
 *   - Most attempted topics
 *   - Average score by topic
 *   - Most difficult questions (lowest correct rate)
 *   - Most correctly answered questions (highest correct rate)
 *   - Question-level answer distribution
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  // 1. Most attempted topics (by completed attempts)
  const topicAttempts = await db.quizAttempt.groupBy({
    by: ["topicId"],
    where: { topicId: { not: null }, completedAt: { not: null } },
    _count: true,
    _avg: { scorePercentage: true },
  });

  const topicIds = topicAttempts.map((t) => t.topicId!).filter(Boolean);
  const topics = await db.topic.findMany({
    where: { id: { in: topicIds } },
    select: { id: true, name: true, subject: { select: { name: true } } },
  });
  const topicMap = new Map(topics.map((t) => [t.id, t]));

  const topTopics = topicAttempts
    .map((t) => {
      const topic = topicMap.get(t.topicId!);
      return {
        topicId: t.topicId,
        topicName: topic?.name ?? "Unknown",
        subjectName: topic?.subject.name ?? "",
        attempts: t._count,
        avgScore: Math.round(t._avg.scorePercentage ?? 0),
      };
    })
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 10);

  // 2. Most difficult / easiest questions (by correct rate)
  // Placeholder answers are created when a quiz starts. Only completed
  // attempts should contribute to published question-quality insights.
  const questionRows = await db.userAnswer.groupBy({
    by: ["questionId", "isCorrect"],
    where: { attempt: { completedAt: { not: null } } },
    _count: { _all: true },
  });

  const counts = new Map<string, { total: number; correct: number }>();
  for (const row of questionRows) {
    const entry = counts.get(row.questionId) ?? { total: 0, correct: 0 };
    entry.total += row._count._all;
    if (row.isCorrect) entry.correct += row._count._all;
    counts.set(row.questionId, entry);
  }

  const questionIds = [...counts.keys()];
  const questions = await db.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      questionText: true,
      correctOption: true,
      topic: { select: { name: true } },
    },
  });
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Require a small sample before ranking a question as hard or easy.
  // Completed quizzes may still include skipped questions in older records;
  // never describe this measure as a pure answered-only rate.
  const MIN_SAMPLE = 5;
  const questionAnalytics = [...counts.entries()]
    .filter(([, item]) => item.total >= MIN_SAMPLE)
    .map(([questionId, item]) => {
      const question = questionMap.get(questionId);
      const rate = Math.round((item.correct / item.total) * 100);
      return {
        questionId,
        questionText: question?.questionText?.substring(0, 100) ?? "Unknown",
        topicName: question?.topic.name ?? "",
        correctOption: question?.correctOption,
        attempts: item.total,
        correctCount: item.correct,
        correctRate: rate,
        difficulty: rate >= 80 ? "Easy" : rate >= 50 ? "Medium" : "Hard",
      };
    })
    .sort((a, b) => a.correctRate - b.correctRate);

  const hardestQuestions = questionAnalytics.slice(0, 10);
  const easiestQuestions = [...questionAnalytics].sort((a, b) => b.correctRate - a.correctRate).slice(0, 10);

  // 3. Overall stats
  const totalAttempts = await db.quizAttempt.count({ where: { completedAt: { not: null } } });
  const totalUsers = await db.user.count({ where: { role: "user" } });
  const avgScore = await db.quizAttempt.aggregate({
    where: { completedAt: { not: null } },
    _avg: { scorePercentage: true },
  });

  return NextResponse.json({
    overview: {
      totalAttempts,
      totalUsers,
      avgScore: Math.round(avgScore._avg.scorePercentage ?? 0),
    },
    topTopics,
    hardestQuestions,
    easiestQuestions,
  });
}
