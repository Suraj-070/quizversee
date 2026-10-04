import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

type Params = { params: Promise<{ id: string }> };

/**
 * Quiz set ↔ question assignment endpoint.
 *
 * POST /api/admin/quiz-sets/[id]/questions
 *   Body: { questionId, action: "add" | "remove" }
 *
 * Adds or removes a single question from a quiz set. Uses the unique
 * constraint on (quizSetId, questionId) to prevent duplicates — adding
 * a question that's already in the set is a no-op (handled gracefully).
 */
export async function POST(request: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id: quizSetId } = await params;
  const body = await request.json().catch(() => null);
  const schema = z.object({
    questionId: z.string().min(1),
    action: z.enum(["add", "remove"]),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { questionId, action } = parsed.data;

  // Verify quiz set exists
  const quizSet = await db.quizSet.findUnique({
    where: { id: quizSetId },
    select: { id: true, classId: true, subjectId: true },
  });
  if (!quizSet) {
    return NextResponse.json({ error: "Quiz set not found" }, { status: 404 });
  }

  // Verify question exists
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { id: true, topic: { select: { subject: { select: { classId: true, id: true } } } } },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // Optionally warn if the question doesn't belong to the quiz set's
  // class/subject scope, but still allow it (admin may want cross-topic
  // sets). We just verify it exists.

  if (action === "add") {
    try {
      await db.quizSetQuestion.create({
        data: { quizSetId, questionId },
      });
    } catch {
      // Unique constraint violation → question already in set → no-op
    }
    return NextResponse.json({ added: true });
  } else {
    await db.quizSetQuestion.deleteMany({
      where: { quizSetId, questionId },
    });
    return NextResponse.json({ removed: true });
  }
}

/**
 * GET /api/admin/quiz-sets/[id]/questions
 * Returns all questions available for assignment — i.e. published
 * questions whose parent class matches the quiz set's class.
 *
 * Query params:
 *   - search (filter question text)
 *   - subjectId (filter by subject)
 *   - topicId (filter by topic)
 *
 * Each question includes `inSet: boolean` indicating whether it's
 * currently assigned to this quiz set.
 */
export async function GET(request: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id: quizSetId } = await params;

  const quizSet = await db.quizSet.findUnique({
    where: { id: quizSetId },
    select: { id: true, classId: true },
  });
  if (!quizSet) {
    return NextResponse.json({ error: "Quiz set not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search");
  const subjectId = url.searchParams.get("subjectId");
  const topicId = url.searchParams.get("topicId");

  const where: {
    status: string;
    topic?: { subject?: { classId?: string; id?: string }; id?: string };
    questionText?: { contains: string };
  } = {
    status: "published",
    topic: { subject: { classId: quizSet.classId } },
  };
  if (subjectId) where.topic!.subject!.id = subjectId;
  if (topicId) where.topic!.id = topicId;
  if (search) where.questionText = { contains: search };

  const [questions, existingLinks] = await Promise.all([
    db.question.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        questionText: true,
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
    }),
    db.quizSetQuestion.findMany({
      where: { quizSetId },
      select: { questionId: true },
    }),
  ]);

  const linkedIds = new Set(existingLinks.map((l) => l.questionId));
  const withFlag = questions.map((q) => ({ ...q, inSet: linkedIds.has(q.id) }));

  return NextResponse.json({ questions: withFlag });
}
