import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/student/quiz-sets?classId=<optional>
 *
 * Returns published quiz sets visible to the student, with their
 * parent class/subject names and question counts.
 *
 * Per PRD §12, quiz sets are an optional grouping of questions.
 * Students can take a quiz set instead of picking a topic.
 */
export async function GET(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");

  // Fetch quiz sets without include (avoids stale-Prisma-client issues).
  const quizSets = await db.quizSet.findMany({
    where: {
      status: "published",
      ...(classId ? { classId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Batch-fetch relations + counts.
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

  const result = quizSets
    .map((qs, idx) => ({
      ...qs,
      class: classMap.get(qs.classId) ?? { id: qs.classId, name: "Unknown" },
      subject: qs.subjectId ? subjectMap.get(qs.subjectId) ?? null : null,
      _count: { questions: counts[idx] },
    }))
    // Filter out quiz sets with 0 questions (they're useless to take)
    .filter((qs) => qs._count.questions > 0);

  return NextResponse.json({ quizSets: result });
}
