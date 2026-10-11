import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * POST /api/student/attempts
 *
 * Starts a new quiz attempt.
 *
 * Two modes:
 *   1. Topic quiz: { topicId, totalQuestions }
 *      - Picks N random published questions from the topic
 *      - totalQuestions must be ≤ published-question count (PRD §14)
 *   2. Quiz set: { quizSetId }
 *      - Uses ALL questions in the quiz set (no count picker)
 *      - The quiz set must be published and have ≥1 question
 *
 * In both modes:
 *   - Creates the QuizAttempt row + placeholder UserAnswer rows
 *     (one per question, initially with isCorrect=false)
 *   - Returns the attempt ID + the questions WITHOUT correctOption
 *     (the client learns correctness only after answering)
 *
 * Returns: { attemptId, questions: QuizQuestionClient[] }
 */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const schema = z
    .object({
      topicId: z.string().min(1).optional(),
      subjectId: z.string().min(1).optional(),
      quizSetId: z.string().min(1).optional(),
      totalQuestions: z.number().int().positive().optional(),
    })
    .refine(
      (data) => !!data.topicId || !!data.quizSetId || !!data.subjectId,
      "Either topicId, subjectId, or quizSetId is required"
    )
    .refine(
      (data) =>
        [data.topicId, data.subjectId, data.quizSetId].filter(Boolean)
          .length === 1,
      "Provide exactly one of: topicId, subjectId, or quizSetId"
    );
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { topicId, subjectId, quizSetId, totalQuestions } = parsed.data;

  // ----- Mode 1: Topic quiz -----
  if (topicId) {
    if (!totalQuestions) {
      return NextResponse.json(
        { error: "totalQuestions is required for topic quizzes" },
        { status: 400 }
      );
    }

    // Verify topic is active
    const topic = await db.topic.findFirst({
      where: { id: topicId, isActive: true },
      select: { id: true, contentType: true },
    });
    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found or not available" },
        { status: 404 }
      );
    }

    // Count published questions
    const publishedCount = await db.question.count({
      where: { topicId, status: "published", archivedAt: null, contentType: topic.contentType },
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
    const questionRows = await db.question.findMany({
      where: { topicId, status: "published", archivedAt: null, contentType: topic.contentType },
      select: { id: true },
    });
    const shuffled = [...questionRows].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, totalQuestions);
    const questionIds = picked.map((q) => q.id);

    const questions = await db.question.findMany({
      where: { id: { in: questionIds } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        questionText: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        explanation: true,
        questionImage: true,
        optionAImage: true,
        optionBImage: true,
        optionCImage: true,
        optionDImage: true,
      },
    });

    const finalOrder = [...questions].sort(() => Math.random() - 0.5);

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
          selectedOption: "A",
          isCorrect: false,
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
      return { ...q, explanation: null, userAnswerId: ua?.id ?? "" };
    });

    return NextResponse.json(
      { attemptId: attempt.id, questions: questionsForClient },
      { status: 201 }
    );
  }

  // ----- Mode 1b: Subject exam (pulls from ALL topics in the subject) -----
  if (subjectId) {
    if (!totalQuestions) {
      return NextResponse.json(
        { error: "totalQuestions is required for subject exams" },
        { status: 400 }
      );
    }

    // Verify subject is active
    const subject = await db.subject.findFirst({
      where: { id: subjectId, isActive: true },
      select: { id: true },
    });
    if (!subject) {
      return NextResponse.json(
        { error: "Subject not found or not available" },
        { status: 404 }
      );
    }

    // Count ALL published questions across all active topics in this subject
    const publishedCount = await db.question.count({
      where: {
        status: "published",
        archivedAt: null,
        contentType: "curriculum",
        topic: { subjectId, isActive: true, archivedAt: null, contentType: "curriculum" },
      },
    });
    if (publishedCount === 0) {
      return NextResponse.json(
        { error: "This subject has no published questions yet" },
        { status: 400 }
      );
    }
    if (totalQuestions > publishedCount) {
      return NextResponse.json(
        {
          error: `Only ${publishedCount} questions available across all topics. Please pick a smaller count.`,
        },
        { status: 400 }
      );
    }

    // Pick N random published questions from ALL topics in the subject.
    // Questions are NEVER repeated within a single exam session — we pick
    // N distinct question IDs from the full pool.
    const questionRows = await db.question.findMany({
      where: {
        status: "published",
        archivedAt: null,
        contentType: "curriculum",
        topic: { subjectId, isActive: true, archivedAt: null, contentType: "curriculum" },
      },
      select: { id: true },
    });
    const shuffled = [...questionRows].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, totalQuestions);
    const questionIds = picked.map((q) => q.id);

    const questions = await db.question.findMany({
      where: { id: { in: questionIds } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        questionText: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        explanation: true,
        questionImage: true,
        optionAImage: true,
        optionBImage: true,
        optionCImage: true,
        optionDImage: true,
      },
    });

    // Re-shuffle so the order is random (not alphabetical by ID)
    const finalOrder = [...questions].sort(() => Math.random() - 0.5);

    const attempt = await db.$transaction(async (tx) => {
      const created = await tx.quizAttempt.create({
        data: {
          userId: user.id,
          topicId: null,
          subjectId,
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
          selectedOption: "A",
          isCorrect: false,
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
      return { ...q, explanation: null, userAnswerId: ua?.id ?? "" };
    });

    return NextResponse.json(
      { attemptId: attempt.id, questions: questionsForClient },
      { status: 201 }
    );
  }

  // ----- Mode 2: Quiz set -----
  // quizSetId is defined here (schema refinement guarantees it)
  const quizSetIdVal = quizSetId!;

  // Fetch the quiz set (without include — avoids stale-Prisma-client issues).
  const quizSet = await db.quizSet.findFirst({
    where: { id: quizSetIdVal, status: "published" },
    select: { id: true, name: true, classId: true, subjectId: true },
  });
  if (!quizSet) {
    return NextResponse.json(
      { error: "Quiz set not found or not published" },
      { status: 404 }
    );
  }

  // Fetch the question IDs linked to this quiz set.
  const questionLinks = await db.quizSetQuestion.findMany({
    where: { quizSetId: quizSet.id },
    select: { questionId: true },
  });

  if (questionLinks.length === 0) {
    return NextResponse.json(
      { error: "This quiz set has no questions" },
      { status: 400 }
    );
  }

  // Fetch the actual question data.
  const questionIds = questionLinks.map((l) => l.questionId);
  const qsQuestions = await db.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      questionText: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      explanation: true,
      questionImage: true,
      optionAImage: true,
      optionBImage: true,
      optionCImage: true,
      optionDImage: true,
    },
  });

  // Use ALL questions in the quiz set, in randomized order.
  const finalOrder = [...qsQuestions].sort(() => Math.random() - 0.5);
  const total = finalOrder.length;

  const attempt = await db.$transaction(async (tx) => {
    const created = await tx.quizAttempt.create({
      data: {
        userId: user.id,
        topicId: null,
        quizSetId: quizSet.id,
        totalQuestions: total,
        correctAnswers: 0,
        scorePercentage: 0,
      },
    });

    await tx.userAnswer.createMany({
      data: finalOrder.map((q) => ({
        attemptId: created.id,
        userId: user.id,
        questionId: q.id,
        selectedOption: "A",
        isCorrect: false,
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
    return {
      id: q.id,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      explanation: null,
      userAnswerId: ua?.id ?? "",
    };
  });

  return NextResponse.json(
    { attemptId: attempt.id, questions: questionsForClient },
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
        quizSet: {
          select: {
            id: true,
            name: true,
            classId: true,
            subjectId: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            class: { select: { id: true, name: true } },
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

    // Results and review must never expose answer keys before completion.
    if (!attempt.completedAt) {
      return NextResponse.json(
        { error: "Review is only available after completing this quiz" },
        { status: 409 }
      );
    }

    // If the attempt has a quizSet, fetch its class/subject names
    // separately (avoids the stale-Prisma-client include issue on
    // QuizSet.class/subject relations).
    let quizSetWithRelations: {
      id: string;
      name: string;
      class: { id: string; name: string } | null;
      subject: { id: string; name: string } | null;
    } | null = null;
    if (attempt.quizSet) {
      const [class_, subject] = await Promise.all([
        db.class.findUnique({
          where: { id: attempt.quizSet.classId },
          select: { id: true, name: true },
        }),
        attempt.quizSet.subjectId
          ? db.subject.findUnique({
              where: { id: attempt.quizSet.subjectId },
              select: { id: true, name: true },
            })
          : Promise.resolve(null),
      ]);
      quizSetWithRelations = {
        id: attempt.quizSet.id,
        name: attempt.quizSet.name,
        class: class_,
        subject,
      };
    }

    return NextResponse.json({
      attempt: { ...attempt, quizSet: quizSetWithRelations },
    });
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
      quizSet: {
        select: {
          id: true,
          name: true,
          classId: true,
          subjectId: true,
        },
      },
      subject: {
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Fetch class/subject names for each quiz set separately (avoids the
  // stale-Prisma-client include issue on QuizSet.class/subject relations).
  const quizSetIds = [
    ...new Set(
      attempts
        .filter((a) => a.quizSet)
        .map((a) => a.quizSet!.id)
    ),
  ];
  const quizSetClassIds = [
    ...new Set(
      attempts
        .filter((a) => a.quizSet)
        .map((a) => a.quizSet!.classId)
    ),
  ];
  const quizSetSubjectIds = [
    ...new Set(
      attempts
        .filter((a) => a.quizSet?.subjectId)
        .map((a) => a.quizSet!.subjectId!)
    ),
  ];

  const [quizSetClasses, quizSetSubjects] = await Promise.all([
    db.class.findMany({
      where: { id: { in: quizSetClassIds } },
      select: { id: true, name: true },
    }),
    db.subject.findMany({
      where: { id: { in: quizSetSubjectIds } },
      select: { id: true, name: true },
    }),
  ]);

  const classMap = new Map(quizSetClasses.map((c) => [c.id, c]));
  const subjectMap = new Map(quizSetSubjects.map((s) => [s.id, s]));

  const attemptsWithRelations = attempts.map((a) => {
    if (!a.quizSet) return a;
    return {
      ...a,
      quizSet: {
        id: a.quizSet.id,
        name: a.quizSet.name,
        class: classMap.get(a.quizSet.classId) ?? null,
        subject: a.quizSet.subjectId
          ? subjectMap.get(a.quizSet.subjectId) ?? null
          : null,
      },
    };
  });

  return NextResponse.json({ attempts: attemptsWithRelations });
}
