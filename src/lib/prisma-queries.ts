import { db } from "@/lib/db";

/**
 * Reusable typed query helpers for admin CRUD operations.
 *
 * These exist to keep the route handlers thin and to centralize the
 * cascade-count logic used by delete-confirmation dialogs.
 *
 * Cascade behavior is configured at the Prisma schema level (`onDelete:
 * Cascade` on the relation), so a `db.class.delete()` already removes
 * all child subjects → topics → questions automatically. These helpers
 * PRE-COMPUTE the affected counts so the UI can warn the admin before
 * they confirm the delete.
 */

// ---------------------------------------------------------------------------
// Class helpers
// ---------------------------------------------------------------------------

export async function countClassChildren(classId: string) {
  const [subjects, topics, questions] = await Promise.all([
    db.subject.count({ where: { classId } }),
    db.topic.count({
      where: { subject: { classId } },
    }),
    db.question.count({
      where: { topic: { subject: { classId } } },
    }),
  ]);
  return { subjects, topics, questions };
}

// ---------------------------------------------------------------------------
// Subject helpers
// ---------------------------------------------------------------------------

export async function countSubjectChildren(subjectId: string) {
  const [topics, questions] = await Promise.all([
    db.topic.count({ where: { subjectId } }),
    db.question.count({
      where: { topic: { subjectId } },
    }),
  ]);
  return { topics, questions };
}

// ---------------------------------------------------------------------------
// Topic helpers
// ---------------------------------------------------------------------------

export async function countTopicChildren(topicId: string) {
  const [questions] = await Promise.all([
    db.question.count({ where: { topicId } }),
  ]);
  return { questions };
}

// ---------------------------------------------------------------------------
// Generic ordering helper
// ---------------------------------------------------------------------------

/**
 * Returns the next displayOrder value for a new row in a given scope.
 * Useful when creating a new entity so it appears at the end of lists.
 */
export async function nextDisplayOrder(scope: {
  model: "class" | "subject" | "topic";
  classId?: string;
  subjectId?: string;
}): Promise<number> {
  let max: number | null = null;
  if (scope.model === "class") {
    const row = await db.class.findFirst({
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });
    max = row?.displayOrder ?? null;
  } else if (scope.model === "subject" && scope.classId) {
    const row = await db.subject.findFirst({
      where: { classId: scope.classId },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });
    max = row?.displayOrder ?? null;
  } else if (scope.model === "topic" && scope.subjectId) {
    const row = await db.topic.findFirst({
      where: { subjectId: scope.subjectId },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });
    max = row?.displayOrder ?? null;
  }
  return (max ?? -1) + 1;
}
