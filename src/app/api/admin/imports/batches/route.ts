import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/imports/batches
 *
 * Returns a list of "import batches" — groups of questions that share the
 * same importBatchId or sourceName. For each batch, returns counts by
 * status (draft / published) and validity (invalid = missing required
 * fields or ambiguous correct answer).
 *
 * The Import Center uses this to render the "drafts to publish" panel.
 *
 * Query params:
 *   - sourceFilter  — "all" (default) | "json" | "dataset"
 *   - page          — 1-indexed (default 1)
 *   - pageSize      — default 25, max 100
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(request.url);
  const sourceFilter = url.searchParams.get("sourceFilter") ?? "all";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "25", 10) || 25)
  );

  // Build the set of distinct (importBatchId, sourceName, sourceType) groups
  // via a raw query because Prisma's groupBy doesn't compose well with
  // multiple nullable columns + conditional aggregation.
  //
  // We only consider questions where importBatchId IS NOT NULL OR sourceType
  // IS NOT NULL — i.e. externally-originated questions.
  const whereClause =
    sourceFilter === "json"
      ? "WHERE sourceType = 'manual' AND importBatchId IS NOT NULL"
      : sourceFilter === "dataset"
        ? "WHERE sourceType = 'dataset'"
        : "WHERE importBatchId IS NOT NULL OR sourceType IS NOT NULL";

  const rows = await db.$queryRawUnsafe<any[]>(
    `
    SELECT
      COALESCE(importBatchId, sourceName) AS batchId,
      MAX(sourceName) AS sourceName,
      MAX(sourceType) AS sourceType,
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
      SUM(CASE WHEN questionText IS NULL OR TRIM(questionText) = ''
               OR optionA IS NULL OR TRIM(optionA) = ''
               OR optionB IS NULL OR TRIM(optionB) = ''
               OR optionC IS NULL OR TRIM(optionC) = ''
               OR optionD IS NULL OR TRIM(optionD) = ''
               OR correctOption NOT IN ('A','B','C','D')
              THEN 1 ELSE 0 END) AS invalid,
      MIN(createdAt) AS firstImportedAt,
      MAX(createdAt) AS lastImportedAt
    FROM Question
    ${whereClause}
    GROUP BY COALESCE(importBatchId, sourceName)
    ORDER BY lastImportedAt DESC
    LIMIT ? OFFSET ?
    `,
    pageSize,
    (page - 1) * pageSize
  );

  const totalRows = await db.$queryRawUnsafe<any[]>(
    `
    SELECT COUNT(*) AS n FROM (
      SELECT 1 FROM Question
      ${whereClause}
      GROUP BY COALESCE(importBatchId, sourceName)
    )
    `
  );
  const total = totalRows[0]?.n ?? 0;

  // Parse the bigint values that SQLite returns through better-sqlite3.
  const batches = rows.map((r) => ({
    batchId: r.batchId,
    sourceName: r.sourceName,
    sourceType: r.sourceType,
    total: Number(r.total),
    drafts: Number(r.drafts),
    published: Number(r.published),
    invalid: Number(r.invalid),
    firstImportedAt: r.firstImportedAt,
    lastImportedAt: r.lastImportedAt,
  }));

  return NextResponse.json({
    batches,
    total: Number(total),
    page,
    pageSize,
  });
}
