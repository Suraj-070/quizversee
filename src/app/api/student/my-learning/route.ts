import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/student/my-learning
 *
 * Returns the student's selected subjects with curriculum topic + question counts.
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
          subject: {
            select: {
              id: true, name: true, description: true, icon: true,
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

  if (!userRecord.currentClassId) {
    return NextResponse.json({ subjects: [], className: null });
  }

  const klass = await db.class.findUnique({
    where: { id: userRecord.currentClassId },
    select: { name: true },
  });

  const subjects = await Promise.all(
    userRecord.selectedSubjects.map(async (s) => {
      const subject = s.subject;
      const topicCount = await db.topic.count({
        where: { subjectId: subject.id, isActive: true, archivedAt: null, contentType: "curriculum" },
      });
      const questionCount = await db.question.count({
        where: {
          status: "published", archivedAt: null, contentType: "curriculum",
          topic: { subjectId: subject.id, isActive: true, contentType: "curriculum" },
        },
      });
      return { ...subject, topicCount, questionCount };
    })
  );

  return NextResponse.json({
    className: klass?.name ?? null,
    subjects: subjects.filter((s) => s.questionCount > 0),
  });
}
