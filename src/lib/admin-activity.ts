import { db } from "@/lib/db";

/**
 * Logs an admin action to the AdminActivity table.
 *
 * Call this after any significant admin mutation (create, edit, publish,
 * archive, import, etc.) to build the activity feed on the dashboard
 * and the Activity Log page.
 *
 * Usage:
 *   await logAdminActivity(adminUser.id, "question.published", "Question", questionId, "Published question: What is...");
 */
export async function logAdminActivity(
  adminId: string | undefined,
  action: string,
  entity: string,
  entityId: string | null,
  description: string
): Promise<void> {
  try {
    await db.adminActivity.create({
      data: {
        adminId: adminId ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        description,
      },
    });
  } catch (err) {
    // Don't fail the parent operation if logging fails
    console.error("[logAdminActivity] failed:", err);
  }
}

/**
 * Common action constants for consistent logging.
 */
export const ADMIN_ACTIONS = {
  QUESTION_CREATED: "question.created",
  QUESTION_EDITED: "question.edited",
  QUESTION_PUBLISHED: "question.published",
  QUESTION_UNPUBLISHED: "question.unpublished",
  QUESTION_ARCHIVED: "question.archived",
  QUESTION_RESTORED: "question.restored",
  QUESTIONS_IMPORTED: "questions.imported",
  TOPIC_CREATED: "topic.created",
  TOPIC_EDITED: "topic.edited",
  TOPIC_ARCHIVED: "topic.archived",
  SUBJECT_CREATED: "subject.created",
  SUBJECT_EDITED: "subject.edited",
  SUBJECT_ARCHIVED: "subject.archived",
  CLASS_CREATED: "class.created",
  CLASS_EDITED: "class.edited",
  CLASS_ARCHIVED: "class.archived",
  ANNOUNCEMENT_CREATED: "announcement.created",
  ANNOUNCEMENT_PUBLISHED: "announcement.published",
  ANNOUNCEMENT_ARCHIVED: "announcement.archived",
  SETTINGS_CHANGED: "settings.changed",
} as const;
