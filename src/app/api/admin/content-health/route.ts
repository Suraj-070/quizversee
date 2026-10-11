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

  // 2. Aggregate outcomes from completed attempts only; exclude unfinished
  // quiz placeholders, and require a sample of at least 10 per question.
  const outcomeRows = await db.userAnswer.groupBy({
    by: ["questionId", "isCorrect"],
    where: { attempt: { completedAt: { not: null } } },
    _count: { _all: true },
  });
  const outcomeTotals = new Map<string, { attempts: number; correct: number }>();
  for (const row of outcomeRows) {
    const totals = outcomeTotals.get(row.questionId) ?? { attempts: 0, correct: 0 };
    totals.attempts += row._count._all;
    if (row.isCorrect) totals.correct += row._count._all;
    outcomeTotals.set(row.questionId, totals);
  }
  const eligible = [...outcomeTotals.entries()].filter(([, total]) => total.attempts >= 10);
  const questions = await db.question.findMany({
    where: { id: { in: eligible.map(([id]) => id) } },
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
  const highCorrectRate: typeof lowCorrectRate = [];

  for (const [questionId, stats] of eligible) {
    const q = questionMap.get(questionId);
    if (!q) continue;
    const rate = Math.round((stats.correct / stats.attempts) * 100);
    const row = {
      questionId: q.id,
      questionText: q.questionText.substring(0, 100),
      topicName: q.topic?.name ?? "",
      subjectName: q.topic?.subject.name ?? "",
      attempts: stats.attempts,
      correctRate: rate,
    };
    if (rate < 30) lowCorrectRate.push(row);
    if (rate > 95) highCorrectRate.push(row);
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
