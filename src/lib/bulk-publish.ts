/**
 * Question validation utilities shared by:
 *   - Bulk publish endpoint (/api/admin/questions/bulk-publish)
 *   - Import Center bulk publish (/api/admin/imports/[id]/bulk-publish)
 *   - Future batch operations
 *
 * Centralising validation guarantees the same rules apply everywhere a
 * question transitions from draft → published.
 */
import { db } from "@/lib/db";

export type QuestionValidationIssue = {
  questionId: string;
  reason: string;
};

export type BulkPublishInput = {
  /** Explicit list of question IDs to operate on. Mutually exclusive with `filter`. */
  questionIds?: string[];
  /** Server-side filter spec — when present, selects ALL matching questions. */
  filter?: {
    classId?: string;
    subjectId?: string;
    topicId?: string;
    status?: "draft" | "published";
    search?: string;
    sourceType?: string;
    sourceName?: string;
    importBatchId?: string;
  };
  /** Target status. "published" promotes drafts; "draft" demotes published. */
  targetStatus: "published" | "draft";
  /** Admin ID for activity logging. */
  adminId: string;
};

export type BulkPublishFailure = {
  questionId: string;
  reason: string;
};

export type BulkPublishResult = {
  selected: number;
  published: number;       // actually transitioned to published
  unpublished: number;     // actually transitioned to draft
  alreadyTarget: number;   // already in the target status (no-op)
  notFound: number;        // IDs that don't exist
  needsReview: number;     // invalid for publishing (missing fields etc.)
  failed: number;          // unexpected errors
  failures: BulkPublishFailure[];
};

/** SQLite has a default parameter limit of 999 per query. Use 500 to be safe. */
const SQLITE_PARAM_CHUNK = 500;

/**
 * Validates a question for publishing. Returns null if valid, or a reason string.
 *
 * Rules:
 *   - All four options must be non-empty
 *   - correctOption must be one of A/B/C/D
 *   - Question text must be non-empty
 *   - Topic must exist
 */
export function validateQuestionForPublish(q: {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  topicId: string;
}): string | null {
  if (!q.questionText?.trim()) return "Missing question text";
  if (!q.optionA?.trim() || !q.optionB?.trim() || !q.optionC?.trim() || !q.optionD?.trim()) {
    return "Missing one or more answer options";
  }
  if (!["A", "B", "C", "D"].includes(q.correctOption)) {
    return "Invalid correct option (must be A/B/C/D)";
  }
  return null;
}

/**
 * Builds a Prisma `where` clause from a server-side filter spec.
 * Used to resolve "select all matching" without sending IDs to the client.
 */
export function filterToWhere(filter: NonNullable<BulkPublishInput["filter"]>): {
  topicId?: string;
  status?: string;
  questionText?: { contains: string };
  topic?: { subjectId?: string; subject?: { classId?: string } };
  sourceType?: string;
  sourceName?: string;
  importBatchId?: string;
} {
  const where: any = {};
  if (filter.topicId) where.topicId = filter.topicId;
  if (filter.status) where.status = filter.status;
  if (filter.search) where.questionText = { contains: filter.search };
  if (filter.sourceType) where.sourceType = filter.sourceType;
  if (filter.sourceName) where.sourceName = filter.sourceName;
  if (filter.importBatchId) where.importBatchId = filter.importBatchId;
  if (filter.subjectId || filter.classId) {
    where.topic = {};
    if (filter.subjectId) where.topic.subjectId = filter.subjectId;
    if (filter.classId) where.topic.subject = { classId: filter.classId };
  }
  return where;
}

/**
 * Executes a bulk status change with full validation, partial-success reporting,
 * and SQLite-safe chunking.
 *
 * Idempotent: re-running on already-target questions reports them as
 * `alreadyTarget` without errors.
 */
export async function executeBulkPublish(
  input: BulkPublishInput
): Promise<BulkPublishResult> {
  const { targetStatus, adminId } = input;

  // 1. Resolve the set of candidate questions.
  let candidateIds: string[];
  let notFoundIds: string[] = [];

  if (input.filter) {
    const where = filterToWhere(input.filter);
    const rows = await db.question.findMany({
      where,
      select: { id: true },
    });
    candidateIds = rows.map((r) => r.id);
  } else if (input.questionIds?.length) {
    // Verify all IDs exist; collect not-found ones.
    const uniqueIds = Array.from(new Set(input.questionIds));
    const existing = await db.question.findMany({
      where: { id: { in: uniqueIds.slice(0, SQLITE_PARAM_CHUNK) } },
      select: { id: true },
    });
    const existingSet = new Set(existing.map((q) => q.id));
    // Handle chunks > 500 by querying in batches.
    for (let i = SQLITE_PARAM_CHUNK; i < uniqueIds.length; i += SQLITE_PARAM_CHUNK) {
      const chunk = uniqueIds.slice(i, i + SQLITE_PARAM_CHUNK);
      const more = await db.question.findMany({
        where: { id: { in: chunk } },
        select: { id: true },
      });
      for (const q of more) existingSet.add(q.id);
    }
    candidateIds = uniqueIds.filter((id) => existingSet.has(id));
    notFoundIds = uniqueIds.filter((id) => !existingSet.has(id));
  } else {
    throw new Error("Either questionIds or filter must be provided");
  }

  const result: BulkPublishResult = {
    selected: candidateIds.length + notFoundIds.length,
    published: 0,
    unpublished: 0,
    alreadyTarget: 0,
    notFound: notFoundIds.length,
    needsReview: 0,
    failed: 0,
    failures: [],
  };

  if (candidateIds.length === 0) return result;

  // 2. Fetch full records to validate.
  const candidates = await db.question.findMany({
    where: { id: { in: candidateIds.slice(0, SQLITE_PARAM_CHUNK) } },
    select: {
      id: true,
      status: true,
      questionText: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      correctOption: true,
      topicId: true,
    },
  });
  // If >500 candidates, fetch in chunks.
  for (let i = SQLITE_PARAM_CHUNK; i < candidateIds.length; i += SQLITE_PARAM_CHUNK) {
    const chunk = candidateIds.slice(i, i + SQLITE_PARAM_CHUNK);
    const more = await db.question.findMany({
      where: { id: { in: chunk } },
      select: {
        id: true, status: true, questionText: true,
        optionA: true, optionB: true, optionC: true, optionD: true,
        correctOption: true, topicId: true,
      },
    });
    candidates.push(...more);
  }

  // 3. Partition: already-target / invalid / ready-to-transition.
  const toTransition: string[] = [];
  for (const q of candidates) {
    if (q.status === targetStatus) {
      result.alreadyTarget++;
      continue;
    }
    if (targetStatus === "published") {
      const issue = validateQuestionForPublish(q);
      if (issue) {
        result.needsReview++;
        result.failures.push({ questionId: q.id, reason: issue });
        continue;
      }
    }
    toTransition.push(q.id);
  }

  if (toTransition.length === 0) return result;

  // 4. Chunked transactional update.
  // Each chunk runs in its own transaction so a single failure doesn't roll
  // back the whole batch — important for very large operations.
  for (let i = 0; i < toTransition.length; i += SQLITE_PARAM_CHUNK) {
    const chunk = toTransition.slice(i, i + SQLITE_PARAM_CHUNK);
    try {
      // Use a single UPDATE with WHERE id IN (...) — most efficient.
      const updated = await db.question.updateMany({
        where: { id: { in: chunk }, status: { not: targetStatus } },
        data: { status: targetStatus },
      });
      if (targetStatus === "published") {
        result.published += updated.count;
      } else {
        result.unpublished += updated.count;
      }
    } catch (err) {
      // SQLite busy/locked errors are transient — fall back to per-id updates.
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("busy") || errMsg.includes("locked")) {
        // Per-id fallback for busy DBs.
        for (const id of chunk) {
          try {
            const r = await db.question.updateMany({
              where: { id, status: { not: targetStatus } },
              data: { status: targetStatus },
            });
            if (targetStatus === "published") result.published += r.count;
            else result.unpublished += r.count;
          } catch (e2) {
            result.failed++;
            result.failures.push({
              questionId: id,
              reason: e2 instanceof Error ? e2.message : "Update failed",
            });
          }
        }
      } else {
        // Non-transient error — record each ID as failed.
        result.failed += chunk.length;
        for (const id of chunk) {
          result.failures.push({ questionId: id, reason: errMsg });
        }
      }
    }
  }

  // 5. Activity log (single entry per bulk op — not per question).
  const action =
    targetStatus === "published"
      ? `questions.bulk_published`
      : `questions.bulk_unpublished`;
  const verb = targetStatus === "published" ? "Published" : "Unpublished";
  try {
    await db.adminActivity.create({
      data: {
        adminId,
        action,
        entity: "Question",
        entityId: null,
        description: `${verb} ${toTransition.length} question(s) in bulk (${result.needsReview} skipped as invalid, ${result.alreadyTarget} already in target status)`,
      },
    });
  } catch (err) {
    console.error("[bulk-publish] activity log failed:", err);
    // Don't fail the operation if logging fails.
  }

  return result;
}
