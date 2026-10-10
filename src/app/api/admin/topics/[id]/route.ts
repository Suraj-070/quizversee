import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { countTopicChildren } from "@/lib/prisma-queries";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/topics/[id]
 */
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const topic = await db.topic.findUnique({
    where: { id },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }
  const counts = await countTopicChildren(id);
  return NextResponse.json({ topic, counts });
}

const UpdateTopicSchema = z.object({
  subjectId: z.string().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

/**
 * PATCH /api/admin/topics/[id]
 */
export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateTopicSchema.safeParse(body);
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

  // Uniqueness within the subject
  if (data.name ?? data.subjectId) {
    const current = await db.topic.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }
    const effectiveSubjectId = data.subjectId ?? current.subjectId;
    const effectiveName = data.name ?? current.name;
    const clash = await db.topic.findFirst({
      where: {
        subjectId: effectiveSubjectId,
        name: effectiveName,
        NOT: { id },
      },
    });
    if (clash) {
      return NextResponse.json(
        { error: "A topic with this name already exists in this subject" },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await db.topic.update({
      where: { id },
      data,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            class: { select: { id: true, name: true } },
          },
        },
        _count: { select: { questions: true } },
      },
    });
    return NextResponse.json({ topic: updated });
  } catch {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }
}

/**
 * DELETE /api/admin/topics/[id]
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  try {
    await db.topic.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }
}
