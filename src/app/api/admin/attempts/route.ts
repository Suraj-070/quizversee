import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/attempts
 *
 * Returns all quiz attempts with filters:
 *   ?classId=&subjectId=&topicId=&userId=
 *
 * Used by the admin Quiz Attempts page.
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const subjectId = url.searchParams.get("subjectId");
  const topicId = url.searchParams.get("topicId");
  const userId = url.searchParams.get("userId");

  const where: {
    topicId?: string;
    subjectId?: string;
    userId?: string;
    completedAt?: { not: null };
  } = { completedAt: { not: null } };

  if (topicId) where.topicId = topicId;
  if (subjectId) where.subjectId = subjectId;
  if (userId) where.userId = userId;
  // classId filter requires nested topic.subject.classId — handle below

  let attempts = await db.quizAttempt.findMany({
    where,
    orderBy: { completedAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true } },
      topic: {
        select: {
          id: true, name: true,
          subject: { select: { id: true, name: true, class: { select: { id: true, name: true } } } },
        },
      },
      subject: { select: { id: true, name: true, class: { select: { id: true, name: true } } } },
      quizSet: { select: { id: true, name: true } },
    },
  });

  // Filter by classId if provided (topic.subject.class or subject.class)
  if (classId) {
    attempts = attempts.filter((a) => {
      if (a.topic?.subject.class.id === classId) return true;
      if (a.subject?.class.id === classId) return true;
      return false;
    });
  }

  return NextResponse.json({ attempts });
}
