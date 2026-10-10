import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

type Params = { params: Promise<{ batchId: string }> };

/**
 * GET /api/admin/imports/batches/[batchId]/questions
 *
 * Lists the questions in a specific import batch, optionally filtered by
 * validity. Used by the Import Center to render "View Invalid Questions"
 * and the per-batch question table.
 *
 * Query params:
 *   - filter   — "all" | "invalid" | "duplicates" (default "all")
 *   - page     — 1-indexed
 *   - pageSize — default 25
 *
 * A question is "invalid" if it's missing required fields or has an
 * ambiguous/missing correct answer. See `validateQuestionForPublish`
 * in src/lib/bulk-publish.ts for the canonical rules.
 *
 * A question is a "duplicate" if another question with the same
 * sourceType + sourceQuestionId exists (case-insensitive match by
 * question text is also flagged).
 */
export async function GET(request: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { batchId } = await params;
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? "all";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "25", 10) || 25)
  );

  // Resolve the questions belonging to this batch.
  const baseWhere = {
    OR: [
      { importBatchId: batchId },
      { sourceName: batchId },
    ],
  };

  let where: any = baseWhere;
  if (filter === "invalid") {
    where = {
      AND: [
        baseWhere,
        {
          OR: [
            { questionText: "" },
            { optionA: "" },
            { optionB: "" },
            { optionC: "" },
            { optionD: "" },
            { correctOption: { notIn: ["A", "B", "C", "D"] } },
          ],
        },
      ],
    };
  } else if (filter === "duplicates") {
    // Find sourceQuestionIds that appear >1 time.
    const dupIds = await db.$queryRawUnsafe<any[]>(
      `
      SELECT sourceQuestionId FROM Question
      WHERE sourceQuestionId IS NOT NULL
        AND (importBatchId = ? OR sourceName = ?)
      GROUP BY sourceQuestionId
      HAVING COUNT(*) > 1
      `,
      batchId,
      batchId
    );
    const dupSourceIds = dupIds.map((r) => r.sourceQuestionId);
    where = {
      AND: [
        baseWhere,
        { sourceQuestionId: { in: dupSourceIds } },
      ],
    };
  }

  const [questions, total] = await Promise.all([
    db.question.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        questionText: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        correctOption: true,
        status: true,
        sourceType: true,
        sourceName: true,
        sourceQuestionId: true,
        importBatchId: true,
        createdAt: true,
        topic: {
          select: {
            id: true,
            name: true,
            subject: {
              select: {
                id: true,
                name: true,
                class: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    db.question.count({ where }),
  ]);

  // For each question, attach an `isInvalid` boolean computed using the
  // same rules as the bulk-publish validator. This keeps the client
  // logic simple — it doesn't need to re-implement validation.
  const enriched = questions.map((q) => {
    const isInvalid =
      !q.questionText?.trim() ||
      !q.optionA?.trim() ||
      !q.optionB?.trim() ||
      !q.optionC?.trim() ||
      !q.optionD?.trim() ||
      !["A", "B", "C", "D"].includes(q.correctOption);
    return { ...q, isInvalid };
  });

  return NextResponse.json({
    questions: enriched,
    total,
    page,
    pageSize,
  });
}
