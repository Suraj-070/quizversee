import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * POST /api/student/attempts
 *
 * Starts a new quiz attempt:
 *   1. Validates topicId + totalQuestions
 *   2. Verifies the topic is active
 *   3. Confirms totalQuestions <= published-question count (PRD §14:
 *      never attempt to generate more questions than exist)
 *   4. Picks N random published questions for this topic
 *   5. Creates the QuizAttempt row + placeholder UserAnswer rows
 *      (one per question, initially with isCorrect=false)
 *   6. Returns the attempt ID + the questions WITHOUT correctOption
 *      (the client learns correctness only after answering)
 *
 * Body: { topicId: string, totalQuestions: number }
 * Returns: { attemptId, questions: QuizQuestionClient[] }
 */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const schema = z.object({
    topicId: z.string().min(1),
    totalQuestions: z.number().int().positive(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { topicId, totalQuestions } = parsed.data;

  // Verify topic is active
  const topic = await db.topic.findFirst({
    where: { id: topicId, isActive: true },
    select: { id: true },
  });
  if (!topic) {
    return NextResponse.json(
      { error: "Topic not found or not available" },
      { status: 404 }
    );
  }

  // Count published questions
  const publishedCount = await db.question.count({
    where: { topicId, status: "published" },
  });
  if (publishedCount === 0) {
    return NextResponse.json(
      { error: "This topic has no published questions yet" },
      { status: 400 }
    );
  }
  if (totalQuestions > publishedCount) {
    return NextResponse.json(
      {
        error: `Only ${publishedCount} question${
          publishedCount === 1 ? "" : "s"
        } available. Please pick a smaller count.`,
      },
      { status: 400 }
    );
  }

  // Pick N random published questions.
  // SQLite-specific: ORDER BY RANDOM() — works for the sandbox.
  // On Postgres this would be ORDER BY RANDOM() too, so portable.
  // We use $queryRaw for the random selection since Prisma doesn't expose
  // ORDER BY RANDOM() in its query builder.
  const questionRows = await db.question.findMany({
    where: { topicId, status: "published" },
    select: { id: true },
  });

  // Shuffle in-process (more portable than relying on a SQL function).
  const shuffled = [...questionRows].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, totalQuestions);
  const questionIds = picked.map((q) => q.id);

  // Fetch the full questions (without correctOption on the wire)
  const questions = await db.question.findMany({
    where: { id: { in: questionIds } },
    orderBy: { id: "asc" }, // stable order for the client
    select: {
      id: true,
      questionText: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      explanation: true,
    },
  });

  // Re-shuffle the questions one more time so the order returned to the
  // student doesn't always match the alphabetical-by-id order from above.
  const finalOrder = [...questions].sort(() => Math.random() - 0.5);

  // Create the attempt + placeholder answers in a transaction.
  const attempt = await db.$transaction(async (tx) => {
    const created = await tx.quizAttempt.create({
      data: {
        userId: user.id,
        topicId,
        totalQuestions,
        correctAnswers: 0,
        scorePercentage: 0,
      },
    });

    await tx.userAnswer.createMany({
      data: finalOrder.map((q) => ({
        attemptId: created.id,
        userId: user.id,
        questionId: q.id,
        selectedOption: "A", // placeholder; will be overwritten on answer
        isCorrect: false,
      })),
    });

    return created;
  });

  // For the client, also include the userAnswerId so the PATCH call knows
  // which row to update.
  const userAnswers = await db.userAnswer.findMany({
    where: { attemptId: attempt.id },
    orderBy: { id: "asc" },
    select: { id: true, questionId: true },
  });

  const questionsForClient = finalOrder.map((q) => {
    const ua = userAnswers.find((a) => a.questionId === q.id);
    return { ...q, userAnswerId: ua?.id ?? "" };
  });

  return NextResponse.json(
    {
      attemptId: attempt.id,
      questions: questionsForClient,
    },
    { status: 201 }
  );
}

/**
 * GET /api/student/attempts?attemptId=<id>
 *
 * Fetches one attempt (for resume-after-refresh, results, or review).
 *
 * If `?attemptId=` is provided, returns one attempt with its questions
 * and answers. Otherwise returns the user's most recent attempts
 * (used by the history screen).
 */
export async function GET(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const url = new URL(request.url);
  const attemptId = url.searchParams.get("attemptId");

  if (attemptId) {
    const attempt = await db.quizAttempt.findFirst({
      where: { id: attemptId, userId: user.id },
      include: {
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
        answers: {
          select: {
            id: true,
            questionId: true,
            selectedOption: true,
            isCorrect: true,
            question: {
              select: {
                id: true,
                questionText: true,
                optionA: true,
                optionB: true,
                optionC: true,
                optionD: true,
                correctOption: true,
                explanation: true,
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
    return NextResponse.json({ attempt });
  }

  // No attemptId → list recent attempts (history)
  const attempts = await db.quizAttempt.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: {
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

  return NextResponse.json({ attempts });
}
