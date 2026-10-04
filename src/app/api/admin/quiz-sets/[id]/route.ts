import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/quiz-sets/[id]
 * Returns one quiz set with its questions (including parent topic chain).
 */
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const quizSet = await db.quizSet.findUnique({
    where: { id },
  });
  if (!quizSet) {
    return NextResponse.json({ error: "Quiz set not found" }, { status: 404 });
  }

  // Fetch relations separately (avoids stale-Prisma-client include issue
  // where QuizSet.class/subject relations aren't recognized).
  const [class_, subject, questionLinks] = await Promise.all([
    db.class.findUnique({
      where: { id: quizSet.classId },
      select: { id: true, name: true },
    }),
    quizSet.subjectId
      ? db.subject.findUnique({
          where: { id: quizSet.subjectId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    db.quizSetQuestion.findMany({
      where: { quizSetId: quizSet.id },
      select: { questionId: true },
    }),
  ]);

  // Fetch the actual questions with their topic chains
  const questionIds = questionLinks.map((l) => l.questionId);
  const questions = questionIds.length
    ? await db.question.findMany({
        where: { id: { in: questionIds } },
        select: {
          id: true,
          questionText: true,
          status: true,
          topicId: true,
        },
      })
    : [];

  // Fetch topic chains for the questions
  const topicIds = [...new Set(questions.map((q) => q.topicId))];
  const topics = topicIds.length
    ? await db.topic.findMany({
        where: { id: { in: topicIds } },
        select: {
          id: true,
          name: true,
          subjectId: true,
        },
      })
    : [];
  const subjectIds = [...new Set(topics.map((t) => t.subjectId))];
  const subjectRecords = subjectIds.length
    ? await db.subject.findMany({
        where: { id: { in: subjectIds } },
        select: {
          id: true,
          name: true,
          classId: true,
        },
      })
    : [];
  const classIdsOfSubjects = [...new Set(subjectRecords.map((s) => s.classId))];
  const classRecords = classIdsOfSubjects.length
    ? await db.class.findMany({
        where: { id: { in: classIdsOfSubjects } },
        select: { id: true, name: true },
      })
    : [];

  const classMap = new Map(classRecords.map((c) => [c.id, c]));
  const subjectMap = new Map(subjectRecords.map((s) => [s.id, s]));
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Reassemble in the original link order
  const questionsWithChain = questionLinks.map((link) => {
    const q = questionMap.get(link.questionId);
    if (!q) return null;
    const topic = topicMap.get(q.topicId);
    const subject = topic ? subjectMap.get(topic.subjectId) : null;
    const klass = subject ? classMap.get(subject.classId) : null;
    return {
      question: {
        id: q.id,
        questionText: q.questionText,
        status: q.status,
        topic: topic
          ? {
              id: topic.id,
              name: topic.name,
              subject: subject
                ? {
                    id: subject.id,
                    name: subject.name,
                    class: klass ?? { id: subject.classId, name: "Unknown" },
                  }
                : null,
            }
          : null,
      },
    };
  }).filter(Boolean);

  return NextResponse.json({
    quizSet: {
      ...quizSet,
      class: class_,
      subject,
      questions: questionsWithChain,
    },
  });
}

const UpdateQuizSetSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  classId: z.string().min(1).optional(),
  subjectId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["draft", "published"]).optional(),
});

/**
 * PATCH /api/admin/quiz-sets/[id]
 */
export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateQuizSetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.name !== undefined) data.name = data.name.trim();
  if (data.description !== undefined) {
    data.description = data.description?.trim() || null;
  }
  if (data.subjectId !== undefined) {
    data.subjectId = data.subjectId || null;
  }

  try {
    const updated = await db.quizSet.update({
      where: { id },
      data,
    });
    // Fetch relations separately (avoids stale-Prisma-client include issue).
    const [class_, subject, count] = await Promise.all([
      db.class.findUnique({
        where: { id: updated.classId },
        select: { id: true, name: true },
      }),
      updated.subjectId
        ? db.subject.findUnique({
            where: { id: updated.subjectId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      db.quizSetQuestion.count({ where: { quizSetId: updated.id } }),
    ]);
    return NextResponse.json({
      quizSet: {
        ...updated,
        class: class_,
        subject,
        _count: { questions: count },
      },
    });
  } catch {
    return NextResponse.json({ error: "Quiz set not found" }, { status: 404 });
  }
}

/**
 * DELETE /api/admin/quiz-sets/[id]
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  try {
    await db.quizSet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Quiz set not found" }, { status: 404 });
  }
}
