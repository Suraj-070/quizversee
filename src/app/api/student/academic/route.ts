import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/student/academic
 *
 * Returns the full academic tree available to the authenticated student:
 *   - Active classes (only isActive = true)
 *   - For each class, active subjects with their topic count + published
 *     question count
 *
 * This single endpoint lets the student home screen render the entire
 * available-content overview in one round-trip. The detail screens
 * (subjects for a class, topics for a subject) use their own endpoints
 * below.
 */
export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const classes = await db.class.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      displayOrder: true,
      subjects: {
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
          displayOrder: true,
          _count: {
            select: {
              topics: { where: { isActive: true } },
            },
          },
        },
      },
    },
  });

  // For each subject, also fetch the published-question count across its
  // topics. Doing this in a follow-up query (rather than a deep nested
  // include) keeps Prisma happy and the SQL readable.
  const subjectsWithCounts = await Promise.all(
    classes.flatMap((c) =>
      c.subjects.map(async (s) => {
        const publishedQuestions = await db.question.count({
          where: {
            status: "published",
            topic: { subjectId: s.id, isActive: true },
          },
        });
        return { classId: c.id, subjectId: s.id, publishedQuestions };
      })
    )
  );

  const countMap = new Map(
    subjectsWithCounts.map((x) => [x.subjectId, x.publishedQuestions])
  );

  const result = classes.map((c) => ({
    ...c,
    subjects: c.subjects.map((s) => ({
      ...s,
      publishedQuestions: countMap.get(s.id) ?? 0,
    })),
  }));

  return NextResponse.json({ classes: result });
}
