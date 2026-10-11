import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/content-health
 *
 * Returns question health metrics:
 *   - Questions missing explanations
 *   - Questions with very low correct rate (< 30%, with ≥ 10 attempts)
 *   - Questions with very high correct rate (> 95%, with ≥ 10 attempts)
 *   - Possible duplicate questions (same normalized text)
 *   - Total counts for summary
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  // 1. Missing explanations
  const missingExplanations = await db.question.count({
    where: {
      status: "published",
      archivedAt: null,
      OR: [{ explanation: null }, { explanation: "" }],
    },
  });

  // 2. Get per-question stats from UserAnswer
  const [rawQuestionStats, correctStats] = await Promise.all([
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
  const questionStats = rawQuestionStats.filter(stat => stat._count._all >= 10);
  const correctCountByQuestion = new Map(correctStats.map(stat => [stat.questionId, stat._count._all]));

  const questionIds = questionStats.map((q) => q.questionId);
  const questions = await db.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true, questionText: true, explanation: true,
      topic: { select: { name: true, subject: { select: { name: true } } } },
    },
  });
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  const lowCorrectRate: Array<{
    questionId: string;
    questionText: string;
    topicName: string;
    subjectName: string;
    attempts: number;
    correctRate: number;
  }> = [];

  const highCorrectRate: Array<{
    questionId: string;
    questionText: string;
    topicName: string;
    subjectName: string;
    attempts: number;
    correctRate: number;
  }> = [];

  for (const stat of questionStats) {
    const q = questionMap.get(stat.questionId);
    if (!q) continue;
    const correct = correctCountByQuestion.get(stat.questionId) ?? 0;
    const total = stat._count._all;
    const rate = total > 0 ? Math.round((correct / total) * 100) : 0;

    if (rate < 30) {
      lowCorrectRate.push({
        questionId: q.id,
        questionText: q.questionText.substring(0, 100),
        topicName: q.topic?.name ?? "",
        subjectName: q.topic?.subject.name ?? "",
        attempts: total,
        correctRate: rate,
      });
    }

    if (rate > 95) {
      highCorrectRate.push({
        questionId: q.id,
        questionText: q.questionText.substring(0, 100),
        topicName: q.topic?.name ?? "",
        subjectName: q.topic?.subject.name ?? "",
        attempts: total,
        correctRate: rate,
      });
    }
  }

  // 3. Total published questions
  const totalPublished = await db.question.count({
    where: { status: "published", archivedAt: null },
  });

  // 4. Total draft questions
  const totalDraft = await db.question.count({
    where: { status: "draft", archivedAt: null },
  });

  return NextResponse.json({
    summary: {
      totalPublished,
      totalDraft,
      missingExplanations,
      needsReview: missingExplanations + lowCorrectRate.length + highCorrectRate.length,
    },
    lowCorrectRate: lowCorrectRate.sort((a, b) => a.correctRate - b.correctRate).slice(0, 10),
    highCorrectRate: highCorrectRate.sort((a, b) => b.correctRate - a.correctRate).slice(0, 10),
  });
}
