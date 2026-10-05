import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * POST /api/student/attempts/practice-wrong
 *
 * Creates a new quiz attempt containing only the questions the student
 * got wrong in a previous attempt.
 *
 * Body: { fromAttemptId: string }
 */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const schema = z.object({ fromAttemptId: z.string().min(1) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { fromAttemptId } = parsed.data;

  const originalAttempt = await db.quizAttempt.findFirst({
    where: { id: fromAttemptId, userId: user.id, completedAt: { not: null } },
    select: { id: true, topicId: true, subjectId: true },
  });
  if (!originalAttempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  const wrongAnswers = await db.userAnswer.findMany({
    where: { attemptId: fromAttemptId, userId: user.id, isCorrect: false },
    select: { questionId: true },
  });

  if (wrongAnswers.length === 0) {
    return NextResponse.json({ error: "No wrong answers to practice" }, { status: 400 });
  }

  const questionIds = wrongAnswers.map((a) => a.questionId);
  const total = questionIds.length;

  const questions = await db.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true, questionText: true, optionA: true, optionB: true,
      optionC: true, optionD: true, explanation: true,
      questionImage: true, optionAImage: true, optionBImage: true,
      optionCImage: true, optionDImage: true,
    },
  });

  const finalOrder = [...questions].sort(() => Math.random() - 0.5);

  const attempt = await db.$transaction(async (tx) => {
    const created = await tx.quizAttempt.create({
      data: {
        userId: user.id,
        topicId: originalAttempt.topicId,
        subjectId: originalAttempt.subjectId,
        totalQuestions: total,
        correctAnswers: 0,
        scorePercentage: 0,
      },
    });
    await tx.userAnswer.createMany({
      data: finalOrder.map((q) => ({
        attemptId: created.id, userId: user.id, questionId: q.id,
        selectedOption: "A", isCorrect: false,
      })),
    });
    return created;
  });

  const userAnswers = await db.userAnswer.findMany({
    where: { attemptId: attempt.id },
    orderBy: { id: "asc" },
    select: { id: true, questionId: true },
  });

  const questionsForClient = finalOrder.map((q) => {
    const ua = userAnswers.find((a) => a.questionId === q.id);
    return { ...q, userAnswerId: ua?.id ?? "" };
  });

  return NextResponse.json({ attemptId: attempt.id, questions: questionsForClient }, { status: 201 });
}
