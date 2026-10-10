import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guard";
import { executeBulkPublish, type BulkPublishResult } from "@/lib/bulk-publish";

/**
 * POST /api/admin/imports/batches/bulk-publish
 *
 * Bulk-publishes valid draft questions belonging to a specific import
 * batch (identified by importBatchId or sourceName).
 *
 * Body:
 *   {
 *     batchId: string,                    // importBatchId or sourceName
 *     onlyValid?: boolean (default true)  // if false, includes invalid
 *     targetStatus?: "published" | "draft" (default "published")
 *   }
 *
 * If onlyValid=true (default), invalid questions are NEVER published —
 * they're reported as `needsReview` in the result. This is the safe
 * default per TASK D requirements.
 */
const Schema = z.object({
  batchId: z.string().min(1, "batchId is required"),
  onlyValid: z.boolean().optional().default(true),
  targetStatus: z.enum(["published", "draft"]).optional().default("published"),
});

export async function POST(request: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { batchId, targetStatus } = parsed.data;

  const { db } = await import("@/lib/db");
  const byBatch = await db.question.findMany({
    where: { importBatchId: batchId },
    select: { id: true },
  });
  const bySource = await db.question.findMany({
    where: { sourceName: batchId },
    select: { id: true },
  });
  const idSet = new Set<string>();
  for (const r of byBatch) idSet.add(r.id);
  for (const r of bySource) idSet.add(r.id);
  const questionIds = Array.from(idSet);

  if (questionIds.length === 0) {
    return NextResponse.json({
      result: {
        selected: 0,
        published: 0,
        unpublished: 0,
        alreadyTarget: 0,
        notFound: 0,
        needsReview: 0,
        failed: 0,
        failures: [],
      } as BulkPublishResult,
    });
  }

  const result: BulkPublishResult = await executeBulkPublish({
    questionIds,
    targetStatus,
    adminId: user.id,
  });

  return NextResponse.json({ result });
}
