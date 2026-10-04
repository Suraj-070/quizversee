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
    where: { id: userAnswerId, attemptId, userId: user.id },
    include: { question: true },
  });
  if (!userAnswer) {
    return NextResponse.json(
      { error: "Answer record not found" },
      { status: 404 }
    );
  }

  const isCorrect = userAnswer.question.correctOption === selectedOption;

  await db.userAnswer.update({
    where: { id: userAnswerId },
    data: { selectedOption, isCorrect, answeredAt: new Date() },
  });

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
