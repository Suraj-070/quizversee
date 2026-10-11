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
  const [questionStats, correctStats] = await Promise.all([
    db.userAnswer.groupBy({
      by: ["questionId"],
      _count: { _all: true },
    }),
    db.userAnswer.groupBy({
      by: ["questionId"],
      where: { isCorrect: true },
      _count: { _all: true },
    }),
  ]);
  const correctCountByQuestion = new Map(correctStats.map(stat => [stat.questionId, stat._count._all]));

  const questionIds = questionStats.map((q) => q.questionId);
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

  const questionAnalytics = questionStats
    .map((q) => {
      const question = questionMap.get(q.questionId);
      const correct = correctCountByQuestion.get(q.questionId) ?? 0;
      const total = q._count._all;
      const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
      return {
        questionId: q.questionId,
        questionText: question?.questionText?.substring(0, 100) ?? "Unknown",
        topicName: question?.topic.name ?? "",
        correctOption: question?.correctOption,
        attempts: total,
        correctCount: correct,
        correctRate: rate,
        difficulty:
          rate >= 80 ? "Easy" : rate >= 50 ? "Medium" : "Hard",
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
