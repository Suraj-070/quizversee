import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * Discover published supplementary topics across all classes and subjects.
 * This endpoint does not change the student's academic profile.
 */
export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const topics = await db.topic.findMany({
    where: {
      contentType: "extra_practice",
      isActive: true,
      archivedAt: null,
      subject: {
        isActive: true,
        archivedAt: null,
        class: { isActive: true, archivedAt: null },
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      subject: {
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: {
          questions: {
            where: { status: "published", archivedAt: null, contentType: "extra_practice" },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const publishedTopics = topics
    .filter((topic) => topic._count.questions > 0)
    .map((topic) => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      questionCount: topic._count.questions,
      subjectId: topic.subject.id,
      subjectName: topic.subject.name,
      classId: topic.subject.class.id,
      className: topic.subject.class.name,
    }));

  return NextResponse.json({ topics: publishedTopics });
}
