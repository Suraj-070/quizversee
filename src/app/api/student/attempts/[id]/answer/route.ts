import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { isLegacyAttempt } from "@/lib/qai-legacy-attempt.mjs";

type Params = { params: Promise<{ id: string }> };
class AnswerConflict extends Error {}
class AnswerMissing extends Error {}
class LegacyAttempt extends Error {}

const schema = z.object({
  userAnswerId: z.string().min(1),
  selectedOption: z.enum(["A", "B", "C", "D"]),
  reveal: z.boolean().optional().default(true),
});

/**
 * PostgreSQL-only transactional answer submission.
 * Deploy ONLY AFTER the additive submittedAt migration and Prisma generate.
 * Locks the parent attempt so completion cannot race with answer submission.
 * Duplicate answers are rejected and never update mastery twice.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id: attemptId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { userAnswerId, selectedOption, reveal } = parsed.data;

  // Deployment gate: the new API must not accept ambiguous pre-rollout attempts.
  const activationAt = process.env.QAI_ANSWER_ACTIVATION_AT;
  if (!activationAt || !Number.isFinite(Date.parse(activationAt))) {
    return NextResponse.json({ error: "Answer integrity upgrade is not activated" }, { status: 503 });
  }
  for (let retry = 0; retry < 3; retry++) {
    try {
      const result = await db.$transaction(async (tx) => {
        // All submit/complete operations serialize on the same attempt lock.
        const unlocked = await tx.$queryRaw<{ id: string; startedAt: Date }[]>`
          SELECT "id", "startedAt" FROM "QuizAttempt"
          WHERE "id" = ${attemptId} AND "userId" = ${user.id}
          AND "completedAt" IS NULL
          FOR UPDATE
        `;
        if (!unlocked.length) throw new AnswerMissing();
        if (isLegacyAttempt(unlocked[0].startedAt, activationAt)) throw new LegacyAttempt();

        const answer = await tx.userAnswer.findFirst({
          where: { id: userAnswerId, attemptId, userId: user.id },
          include: { question: { select: { correctOption: true, explanation: true } } },
        });
        if (!answer) throw new AnswerMissing();

        const isCorrect = answer.question.correctOption === selectedOption;
        const now = new Date();
        const claimed = await tx.userAnswer.updateMany({
          where: { id: userAnswerId, attemptId, userId: user.id, submittedAt: null },
          data: { selectedOption, isCorrect, answeredAt: now, submittedAt: now },
        });
        if (claimed.count !== 1) throw new AnswerConflict();

        const existing = await tx.questionMastery.findUnique({
          where: { userId_questionId: { userId: user.id, questionId: answer.questionId } },
        });
        if (existing) {
          const streak = isCorrect ? existing.currentStreak + 1 : 0;
          const ease = isCorrect
            ? Math.min(2.5, existing.easeFactor + 0.1)
            : Math.max(1.3, existing.easeFactor - 0.2);
          const interval = isCorrect
            ? (streak === 1 ? 1 : Math.max(1, Math.round(existing.intervalDays * ease)))
            : 0;
          const nextDue = new Date(now.getTime() + interval * 86_400_000);
          await tx.questionMastery.update({
            where: { id: existing.id },
            data: {
              timesSeen: { increment: 1 },
              timesCorrect: { increment: isCorrect ? 1 : 0 },
              currentStreak: streak,
              easeFactor: ease,
              intervalDays: interval,
              lastSeenAt: now,
              nextDueAt: nextDue,
            },
          });
        } else {
          await tx.questionMastery.create({
            data: {
              userId: user.id,
              questionId: answer.questionId,
              timesSeen: 1,
              timesCorrect: isCorrect ? 1 : 0,
              currentStreak: isCorrect ? 1 : 0,
              easeFactor: 2.5,
              intervalDays: isCorrect ? 1 : 0,
              lastSeenAt: now,
              nextDueAt: new Date(now.getTime() + (isCorrect ? 86_400_000 : 0)),
            },
          });
        }
        return { isCorrect, correctOption: answer.question.correctOption, explanation: answer.question.explanation };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 });

      if (!reveal) return NextResponse.json({ recorded: true });
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof LegacyAttempt)
        return NextResponse.json({ error: "This quiz was started before the answer upgrade. Please start a new quiz." }, { status: 409 });
      if (err instanceof AnswerConflict)
        return NextResponse.json({ error: "This answer was already submitted" }, { status: 409 });
      if (err instanceof AnswerMissing)
        return NextResponse.json({ error: "Answer not found or attempt already completed" }, { status: 404 });
      if (err instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(err.code) && retry < 2)
        continue;
      console.error("[answer] transactional submission failed", err);
      return NextResponse.json({ error: "Unable to record answer" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Please retry submission" }, { status: 503 });
}
