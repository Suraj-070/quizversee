import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/student/subjects?classId=<id>
 *
 * Returns active subjects for a given class, with:
 *   - topic count (active topics only)
 *   - published-question count across all the subject's active topics
 */
export async function GET(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  if (!classId) {
    return NextResponse.json(
      { error: "classId is required" },
      { status: 400 }
    );
  }

  // Verify the class is active so students can't peek at disabled classes
  // by guessing IDs.
  const klass = await db.class.findFirst({
    where: { id: classId, isActive: true },
    select: { id: true, name: true, description: true },
  });
  if (!klass) {
    return NextResponse.json(
      { error: "Class not found or not available" },
      { status: 404 }
    );
  }

  const subjects = await db.subject.findMany({
    where: { classId, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      displayOrder: true,
      _count: { select: { topics: { where: { isActive: true, archivedAt: null, contentType: "curriculum" } } } },
    },
  });

  const subjectsWithCounts = await Promise.all(
    subjects.map(async (s) => {
      const publishedQuestions = await db.question.count({
        where: {
          status: "published",
          archivedAt: null,
          contentType: "curriculum",
          topic: { subjectId: s.id, isActive: true, archivedAt: null, contentType: "curriculum" },
        },
      });
      return { ...s, publishedQuestions };
    })
  );

  return NextResponse.json({
    class: klass,
    subjects: subjectsWithCounts,
  });
}
