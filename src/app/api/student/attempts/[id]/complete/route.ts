import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/student/attempts/[id]/complete
 *
 * Marks an attempt as complete and computes the final score.
 *
 * - Sums up correctAnswers from the UserAnswer rows
 * - Computes scorePercentage = correct / total * 100
 * - Sets completedAt
 *
 * Idempotent: if the attempt is already completed, returns the existing
 * score without re-computing.
 */
export async function POST(_req: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id: attemptId } = await params;

  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId: user.id },
    include: {
      answers: { select: { isCorrect: true } },
      topic: {
        select: {
          id: true,
          name: true,
          subject: {
            select: {
              id: true,
              name: true,
              class: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!attempt) {
    return NextResponse.json(
      { error: "Attempt not found" },
      { status: 404 }
    );
  }

  // Already completed → return existing
  if (attempt.completedAt) {
    return NextResponse.json({
      attemptId: attempt.id,
      correctAnswers: attempt.correctAnswers,
      totalQuestions: attempt.totalQuestions,
      scorePercentage: attempt.scorePercentage,
      completedAt: attempt.completedAt,
      topic: attempt.topic,
    });
  }

  const correctAnswers = attempt.answers.filter((a) => a.isCorrect).length;
  const scorePercentage =
    attempt.totalQuestions > 0
      ? (correctAnswers / attempt.totalQuestions) * 100
      : 0;

  const updated = await db.quizAttempt.update({
    where: { id: attemptId },
    data: {
      correctAnswers,
      scorePercentage,
      completedAt: new Date(),
    },
  });

  return NextResponse.json({
    attemptId: updated.id,
    correctAnswers: updated.correctAnswers,
    totalQuestions: updated.totalQuestions,
    scorePercentage: updated.scorePercentage,
    completedAt: updated.completedAt,
    topic: attempt.topic,
  });
}
