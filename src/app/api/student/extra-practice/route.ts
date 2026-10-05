import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/student/extra-practice
 *
 * Returns extra practice topics for the student's selected subjects.
 * These are topics with contentType = "extra_practice" that belong
 * to the student's selected subjects.
 *
 * If no extra practice topics exist yet, returns empty — the UI shows
 * an "coming soon" empty state.
 */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const userRecord = await db.user.findUnique({
    where: { id: user.id },
    select: {
      currentClassId: true,
      selectedSubjects: {
        select: {
          subjectId: true,
          subject: {
            select: {
              id: true, name: true, icon: true,
              class: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!userRecord) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // If no subjects selected, return empty
  if (userRecord.selectedSubjects.length === 0) {
    return NextResponse.json({ subjects: [], className: null });
  }

  const klass = userRecord.currentClassId
    ? await db.class.findUnique({ where: { id: userRecord.currentClassId }, select: { name: true } })
    : null;

  // For each selected subject, fetch extra practice topics + question counts
  const subjectsWithPractice = await Promise.all(
    userRecord.selectedSubjects.map(async (s) => {
      const topics = await db.topic.findMany({
        where: {
          subjectId: s.subjectId,
          isActive: true,
          archivedAt: null,
          contentType: "extra_practice",
        },
        select: {
          id: true, name: true, description: true, displayOrder: true,
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      });

      // For each topic, count published extra practice questions
      const topicsWithCounts = await Promise.all(
        topics.map(async (t) => {
          const questionCount = await db.question.count({
            where: {
              topicId: t.id,
              status: "published",
              archivedAt: null,
              contentType: "extra_practice",
            },
          });
          return { ...t, questionCount };
        })
      );

      return {
        id: s.subject.id,
        name: s.subject.name,
        icon: s.subject.icon,
        topics: topicsWithCounts.filter((t) => t.questionCount > 0),
      };
    })
  );

  // Filter out subjects with no available practice topics
  const availableSubjects = subjectsWithPractice.filter(
    (s) => s.topics.length > 0
  );

  return NextResponse.json({
    className: klass?.name ?? null,
    subjects: availableSubjects,
  });
}
