import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

// Force dynamic to avoid any caching of the Prisma client at build time.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/quiz-sets?classId=<optional>&subjectId=<optional>
 *
 * Returns quiz sets with their parent class/subject names and question counts.
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const subjectId = url.searchParams.get("subjectId");

  const where: {
    classId?: string;
    subjectId?: string;
  } = {};
  if (classId) where.classId = classId;
  if (subjectId) where.subjectId = subjectId;

  // Fetch quiz sets without include (avoids stale-Prisma-client issues in
  // dev where the QuizSet relations aren't recognized). We fetch the
  // parent class/subject names + question counts in follow-up queries.
  const quizSets = await db.quizSet.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Batch-fetch the parent class/subject names + question counts.
  const classIds = [...new Set(quizSets.map((qs) => qs.classId))];
  const subjectIds = [
    ...new Set(quizSets.filter((qs) => qs.subjectId).map((qs) => qs.subjectId!)),
  ];

  const [classes, subjects, counts] = await Promise.all([
    db.class.findMany({
      where: { id: { in: classIds } },
      select: { id: true, name: true },
    }),
    db.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true },
    }),
    Promise.all(
      quizSets.map((qs) =>
        db.quizSetQuestion.count({ where: { quizSetId: qs.id } })
      )
    ),
  ]);

  const classMap = new Map(classes.map((c) => [c.id, c]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const result = quizSets.map((qs, idx) => ({
    ...qs,
    class: classMap.get(qs.classId) ?? { id: qs.classId, name: "Unknown" },
    subject: qs.subjectId ? subjectMap.get(qs.subjectId) ?? null : null,
    _count: { questions: counts[idx] },
  }));

  return NextResponse.json({ quizSets: result });
}

const CreateQuizSetSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["draft", "published"]).optional().default("draft"),
});

/**
 * POST /api/admin/quiz-sets
 * Creates a new quiz set.
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = CreateQuizSetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, classId, subjectId, description, status } = parsed.data;

  // Verify the parent class exists
  const klass = await db.class.findUnique({
    where: { id: classId },
    select: { id: true },
  });
  if (!klass) {
    return NextResponse.json(
      { error: "Selected class does not exist" },
      { status: 400 }
    );
  }

  // Verify the parent subject (if provided) belongs to the class
  if (subjectId) {
    const subject = await db.subject.findFirst({
      where: { id: subjectId, classId },
      select: { id: true },
    });
    if (!subject) {
      return NextResponse.json(
        { error: "Selected subject does not belong to this class" },
        { status: 400 }
      );
    }
  }

  const quizSet = await db.quizSet.create({
    data: {
      name: name.trim(),
      classId,
      subjectId: subjectId || null,
      description: description?.trim() || null,
      status,
    },
  });

  // Fetch the relations separately (avoids include on the create call,
  // which can fail with a stale Prisma client in dev).
  const class_ = await db.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true },
  });
  const subject = subjectId
    ? await db.subject.findUnique({
        where: { id: subjectId },
        select: { id: true, name: true },
      })
    : null;
  const count = await db.quizSetQuestion.count({
    where: { quizSetId: quizSet.id },
  });

  return NextResponse.json(
    {
      quizSet: {
        ...quizSet,
        class: class_,
        subject,
        _count: { questions: count },
      },
    },
    { status: 201 }
  );
}
