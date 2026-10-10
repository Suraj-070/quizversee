import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { countSubjectChildren } from "@/lib/prisma-queries";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/subjects/[id]
 * Returns one subject plus a count of its child topics/questions.
 */
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const subject = await db.subject.findUnique({
    where: { id },
    include: { class: { select: { id: true, name: true } } },
  });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }
  const counts = await countSubjectChildren(id);
  return NextResponse.json({ subject, counts });
}

const UpdateSubjectSchema = z.object({
  classId: z.string().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(60).optional().nullable(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

/**
 * PATCH /api/admin/subjects/[id]
 */
export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateSubjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.name !== undefined) data.name = data.name.trim();
  if (data.description !== undefined) {
    data.description = data.description?.trim() || null;
  }
  if (data.icon !== undefined) {
    data.icon = data.icon?.trim() || null;
  }

  // Uniqueness within the class (if name or class changed)
  if (data.name ?? data.classId) {
    const current = await db.subject.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }
    const effectiveClassId = data.classId ?? current.classId;
    const effectiveName = data.name ?? current.name;
    const clash = await db.subject.findFirst({
      where: {
        classId: effectiveClassId,
        name: effectiveName,
        NOT: { id },
      },
    });
    if (clash) {
      return NextResponse.json(
        { error: "A subject with this name already exists in this class" },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await db.subject.update({
      where: { id },
      data,
      include: {
        class: { select: { id: true, name: true } },
        _count: { select: { topics: true } },
      },
    });
    return NextResponse.json({ subject: updated });
  } catch {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }
}

/**
 * DELETE /api/admin/subjects/[id]
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  try {
    await db.subject.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }
}
