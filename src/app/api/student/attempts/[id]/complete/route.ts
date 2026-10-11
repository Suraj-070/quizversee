import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { isLegacyAttempt } from "@/lib/qai-legacy-attempt.mjs";
import { isRetryableTransactionError } from "@/lib/qai-retryable-transaction.mjs";

type Params = { params: Promise<{ id: string }> };
class AttemptMissing extends Error {}
class LegacyAttempt extends Error {}

/** PostgreSQL rollout: locks the attempt to prevent a completion/submission race. */
export async function POST(_req: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id: attemptId } = await params;

  // Deployment gate: the new API must not accept ambiguous pre-rollout attempts.
  const activationAt = process.env.QAI_ANSWER_ACTIVATION_AT;
  if (!activationAt || !Number.isFinite(Date.parse(activationAt))) {
    return NextResponse.json({ error: "Answer integrity upgrade is not activated" }, { status: 503 });
  }
  for (let retry = 0; retry < 3; retry++) {
    try {
      const result = await db.$transaction(async tx => {
        const locked = await tx.$queryRaw<{ id: string; startedAt: Date }[]>`
          SELECT "id", "startedAt" FROM "QuizAttempt"
          WHERE "id" = ${attemptId} AND "userId" = ${user.id}
          FOR UPDATE
        `;
        if (!locked.length) throw new AttemptMissing();

        const attempt = await tx.quizAttempt.findFirst({
          where: { id: attemptId, userId: user.id },
          include: {
            answers: { select: { isCorrect: true, submittedAt: true } },
            topic: {
              select: {
                id: true, name: true,
                subject: { select: { id: true, name: true, class: { select: { id: true, name: true } } } },
              },
            },
          },
        });
        if (!attempt) throw new AttemptMissing();
        if (!attempt.completedAt && isLegacyAttempt(locked[0].startedAt, activationAt)) throw new LegacyAttempt();
        if (attempt.completedAt) {
          return {
            attemptId: attempt.id, correctAnswers: attempt.correctAnswers,
            totalQuestions: attempt.totalQuestions, scorePercentage: attempt.scorePercentage,
            completedAt: attempt.completedAt, topic: attempt.topic,
          };
        }
        const correctAnswers = attempt.answers.filter(a => a.submittedAt !== null && a.isCorrect).length;
        const scorePercentage = attempt.totalQuestions > 0
          ? correctAnswers / attempt.totalQuestions * 100 : 0;
        const updated = await tx.quizAttempt.update({
          where: { id: attempt.id },
          data: { correctAnswers, scorePercentage, completedAt: new Date() },
        });
        return {
          attemptId: updated.id, correctAnswers: updated.correctAnswers,
          totalQuestions: updated.totalQuestions, scorePercentage: updated.scorePercentage,
          completedAt: updated.completedAt, topic: attempt.topic,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 });
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof LegacyAttempt)
        return NextResponse.json({ error: "This quiz was started before the answer upgrade. Please start a new quiz." }, { status: 409 });
      if (err instanceof AttemptMissing)
        return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
      if (isRetryableTransactionError(err) && retry < 2)
        continue;
      console.error("[complete] transactional completion failed", err);
      return NextResponse.json({ error: "Unable to complete attempt" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Please retry completion" }, { status: 503 });
}
