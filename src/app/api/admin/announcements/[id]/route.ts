import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/announcements/[id]
 */
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const announcement = await db.announcement.findUnique({ where: { id } });
  if (!announcement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ announcement });
}

const UpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(2000).optional(),
  status: z.enum(["draft", "published"]).optional(),
  publishDate: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
});

/**
 * PATCH /api/admin/announcements/[id]
 */
export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }

  const data = parsed.data;
  if (data.publishDate) data.publishDate = new Date(data.publishDate).toISOString() as unknown as string;
  if (data.expiryDate) data.expiryDate = new Date(data.expiryDate).toISOString() as unknown as string;
  if (data.expiryDate === null) data.expiryDate = null as unknown as string;

  try {
    const updated = await db.announcement.update({ where: { id }, data: data as Record<string, unknown> });
    return NextResponse.json({ announcement: updated });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/**
 * DELETE /api/admin/announcements/[id] (archives)
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  try {
    await db.announcement.update({ where: { id }, data: { archivedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
