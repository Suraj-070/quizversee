import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/student/attempts/[id]/answer
 *
 * Records the user's answer for one question.
 *
 * Body:
 *   { userAnswerId, selectedOption, reveal? }
 *
 * - `reveal` defaults to `true` (immediate-feedback mode).
 * - When `reveal: false` (exam mode), the server still records the answer
 *   and computes isCorrect, but does NOT return correctOption/explanation.
 *   The client learns the result only after calling /complete at the end.
 *
 * CRITICAL SAFETY: this endpoint NEVER reveals the correctOption
 * before the user has submitted. The client calls this with their
 * chosen answer, the server compares to the correct answer from the
 * Question table, updates the UserAnswer row, and ONLY THEN returns
 * the correct option + explanation (when reveal=true). This prevents
 * a determined student from reading the answers from the network tab.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id: attemptId } = await params;

  const body = await request.json().catch(() => null);
  const schema = z.object({
    userAnswerId: z.string().min(1),
    selectedOption: z.enum(["A", "B", "C", "D"]),
    reveal: z.boolean().optional().default(true),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { userAnswerId, selectedOption, reveal } = parsed.data;

  // Verify the answer row exists, belongs to this attempt, and the
  // attempt belongs to this user.
  const userAnswer = await db.userAnswer.findFirst({
    where: { id: userAnswerId, attemptId, userId: user.id, attempt: { userId: user.id, completedAt: null } },
    include: { question: true },
  });
  if (!userAnswer) {
    return NextResponse.json(
      { error: "Answer record not found or attempt already completed" },
      { status: 404 }
    );
  }

  const isCorrect = userAnswer.question.correctOption === selectedOption;

  await db.userAnswer.update({
    where: { id: userAnswerId },
    data: { selectedOption, isCorrect, answeredAt: new Date() },
  });

  // Update QuestionMastery for spaced repetition (SM-2-inspired).
  // This tracks how well the student knows this question so future
  // quizzes can prioritize "due" questions (ones they got wrong before).
  try {
    const existing = await db.questionMastery.findUnique({
      where: { userId_questionId: { userId: user.id, questionId: userAnswer.questionId } },
    });

    if (existing) {
      // SM-2-inspired update
      const newStreak = isCorrect ? existing.currentStreak + 1 : 0;
      // Ease factor: decrease if wrong, increase slightly if correct (clamped 1.3–2.5)
      const newEase = isCorrect
        ? Math.min(2.5, existing.easeFactor + 0.1)
        : Math.max(1.3, existing.easeFactor - 0.2);
      // Interval: 0 if wrong (due immediately), otherwise grows with streak
      const newInterval = isCorrect
        ? Math.round(
            newStreak === 1
              ? 1
              : existing.intervalDays * newEase
          )
        : 0;
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + newInterval);

      await db.questionMastery.update({
        where: { id: existing.id },
        data: {
          timesSeen: existing.timesSeen + 1,
          timesCorrect: existing.timesCorrect + (isCorrect ? 1 : 0),
          currentStreak: newStreak,
          easeFactor: newEase,
          intervalDays: newInterval,
          lastSeenAt: new Date(),
          nextDueAt: nextDue,
        },
      });
    } else {
      // First time seeing this question
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + (isCorrect ? 1 : 0));

      await db.questionMastery.create({
        data: {
          userId: user.id,
          questionId: userAnswer.questionId,
          timesSeen: 1,
          timesCorrect: isCorrect ? 1 : 0,
          currentStreak: isCorrect ? 1 : 0,
          easeFactor: 2.5,
          intervalDays: isCorrect ? 1 : 0,
          lastSeenAt: new Date(),
          nextDueAt: nextDue,
        },
      });
    }
  } catch (masteryErr) {
    // Don't fail the answer recording if mastery update fails
    console.error("[mastery] update failed", masteryErr);
  }

  // In exam mode (reveal=false), don't return the correct answer or
  // explanation — the student sees those only on the results/review
  // screen after completing the whole quiz.
  if (!reveal) {
    return NextResponse.json({ recorded: true });
  }

  return NextResponse.json({
    isCorrect,
    correctOption: userAnswer.question.correctOption,
    explanation: userAnswer.question.explanation,
  });
}
