import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guard";
import { executeBulkPublish, type BulkPublishResult } from "@/lib/bulk-publish";

/**
 * POST /api/admin/questions/bulk-publish
 *
 * Server-side bulk status change for questions. Accepts either:
 *   1. An explicit list of question IDs, OR
 *   2. A server-side filter spec (selects ALL matching across pages).
 *
 * Body:
 *   {
 *     questionIds?: string[],
 *     filter?: { classId?, subjectId?, topicId?, status?, search?,
 *                sourceType?, sourceName?, importBatchId? },
 *     targetStatus: "published" | "draft"
 *   }
 *
 * Returns a partial-success report:
 *   { selected, published, unpublished, alreadyTarget,
 *     notFound, needsReview, failed, failures[] }
 *
 * Idempotent: re-running on already-target questions is a no-op.
 */
const BulkPublishSchema = z.object({
  questionIds: z.array(z.string().min(1)).max(5000, "Max 5000 IDs per request").optional(),
  filter: z
    .object({
      classId: z.string().optional(),
      subjectId: z.string().optional(),
      topicId: z.string().optional(),
      status: z.enum(["draft", "published"]).optional(),
      search: z.string().max(200).optional(),
      sourceType: z.string().optional(),
      sourceName: z.string().optional(),
      importBatchId: z.string().optional(),
    })
    .optional(),
  targetStatus: z.enum(["published", "draft"]),
}).refine(
  (d) => d.questionIds?.length || d.filter,
  { message: "Either questionIds or filter must be provided" }
);

export async function POST(request: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = BulkPublishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const result: BulkPublishResult = await executeBulkPublish({
      questionIds: parsed.data.questionIds,
      filter: parsed.data.filter,
      targetStatus: parsed.data.targetStatus,
      adminId: user.id,
    });

    return NextResponse.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bulk publish failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
