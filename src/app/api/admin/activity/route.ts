import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/activity
 * Returns recent admin activity log entries.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const activities = await db.adminActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      admin: { select: { name: true } },
    },
  });

  return NextResponse.json({ activities });
}
