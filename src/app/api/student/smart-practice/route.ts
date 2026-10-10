import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { chooseAdaptiveQuestions } from "@/lib/qai-smart-selector.mjs";

/**
 * POST /api/student/smart-practice
 *
 * Creates a quiz attempt with a SMART mix of questions:
 *   - ~40% previously incorrect questions (from QuestionMastery where isCorrect=false)
 *   - ~30% less-practiced questions (low timesSeen)
 *   - ~30% random questions
 *
 * This uses the existing quiz engine — no duplicate quiz system.
 *
 * Body: { topicId: string, totalQuestions: number }
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
    where: { id: topicId, isActive: true, archivedAt: null },
    select: { id: true },
  });
  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // Get all published question IDs for this topic
  const allQuestions = await db.question.findMany({
    where: { topicId, status: "published", archivedAt: null },
    select: { id: true },
  });

  if (allQuestions.length === 0) {
    return NextResponse.json({ error: "No published questions" }, { status: 400 });
  }

  if (totalQuestions > allQuestions.length) {
    return NextResponse.json(
      { error: `Only ${allQuestions.length} questions available` },
      { status: 400 }
    );
  }

  // QAI is opt-in. With the flag off, preserve the original Smart Practice mix.
  // Both branches feed the existing attempt creation and answer APIs.
  const finalIds: string[] = process.env.QAI_SMART_PRACTICE_V1 === "true"
    ? await (async () => {
        const ids = allQuestions.map(q => q.id);
        const [mastery, recentlyAnswered] = await Promise.all([
          db.questionMastery.findMany({
            where: { userId: user.id, questionId: { in: ids } },
            select: { questionId: true, timesSeen: true, timesCorrect: true, nextDueAt: true, lastSeenAt: true },
          }),
          db.userAnswer.findMany({
            where: { userId: user.id, questionId: { in: ids }, attempt: { completedAt: { not: null } } },
            orderBy: { answeredAt: "desc" },
            take: 30,
            select: { questionId: true },
          }),
        ]);
        return chooseAdaptiveQuestions({
          questions: allQuestions, mastery, count: totalQuestions,
          recentIds: recentlyAnswered.map(answer => answer.questionId),
        });
      })()
    : await (async () => {
      // 1. Fetch previously incorrect questions (from mastery)
      const incorrectMastery = await db.questionMastery.findMany({
        where: {
          userId: user.id,
          timesSeen: { gte: 1 },
          timesCorrect: 0,
          question: { topicId, status: "published", archivedAt: null },
        },
        select: { questionId: true },
      });
      const incorrectIds = incorrectMastery.map((m) => m.questionId);
    
      // 2. Fetch less-practiced questions (low timesSeen, including never-seen)
      const masteryRecords = await db.questionMastery.findMany({
        where: { userId: user.id, question: { topicId } },
        select: { questionId: true, timesSeen: true },
      });
      const seenMap = new Map(masteryRecords.map((m) => [m.questionId, m.timesSeen]));
      const neverSeenIds = allQuestions
        .map((q) => q.id)
        .filter((id) => !seenMap.has(id));
      const lessPracticedIds = masteryRecords
        .filter((m) => m.timesSeen <= 2)
        .map((m) => m.questionId);
    
      // 3. All remaining questions for random selection
      const allIds = allQuestions.map((q) => q.id);
    
      // Calculate counts (flexible — don't exceed available)
      const wrongTarget = Math.min(
        Math.floor(totalQuestions * 0.4),
        incorrectIds.length
      );
      const lessPracticedTarget = Math.min(
        Math.floor(totalQuestions * 0.3),
        lessPracticedIds.length + neverSeenIds.length
      );
      const randomTarget = totalQuestions - wrongTarget - lessPracticedTarget;
    
      // Select questions
      const shuffle = <T>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
    
      const selectedIds = new Set<string>();
    
      // Add incorrect questions
      for (const id of shuffle(incorrectIds).slice(0, wrongTarget)) {
        selectedIds.add(id);
      }
    
      // Add less-practiced + never-seen
      const lessPracticedPool = shuffle([...lessPracticedIds, ...neverSeenIds]);
      for (const id of lessPracticedPool.slice(0, lessPracticedTarget)) {
        if (selectedIds.size < totalQuestions) selectedIds.add(id);
      }
    
      // Fill remaining with random
      const remainingPool = shuffle(allIds.filter((id) => !selectedIds.has(id)));
      for (const id of remainingPool) {
        if (selectedIds.size >= totalQuestions) break;
        selectedIds.add(id);
      }
    
      return Array.from(selectedIds).slice(0, totalQuestions);
    
    
    })();

  // Fetch full question data
  const questions = await db.question.findMany({
    where: { id: { in: finalIds } },
    select: {
      id: true, questionText: true, optionA: true, optionB: true,
      optionC: true, optionD: true, explanation: true,
      questionImage: true, optionAImage: true, optionBImage: true,
      optionCImage: true, optionDImage: true,
    },
  });

  const finalOrder = [...questions].sort(() => Math.random() - 0.5);

  // Create attempt
  const attempt = await db.$transaction(async (tx) => {
    const created = await tx.quizAttempt.create({
      data: {
        userId: user.id,
        topicId,
        totalQuestions: finalOrder.length,
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

  return NextResponse.json(
    { attemptId: attempt.id, questions: questionsForClient },
    { status: 201 }
  );
}
