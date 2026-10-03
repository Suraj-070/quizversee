import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { countClassChildren } from "@/lib/prisma-queries";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/classes/[id]
 * Returns one class plus a count of its child subjects/topics/questions
 * (used by the delete-confirmation dialog).
 */
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const klass = await db.class.findUnique({ where: { id } });
  if (!klass) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }
  const counts = await countClassChildren(id);
  return NextResponse.json({ class: klass, counts });
}

const UpdateClassSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

/**
 * PATCH /api/admin/classes/[id]
 * Updates a class. Sends only the fields present in the body.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateClassSchema.safeParse(body);
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

  // Uniqueness check on name (if changed)
  if (data.name) {
    const clash = await db.class.findFirst({
      where: { name: data.name, NOT: { id } },
    });
    if (clash) {
      return NextResponse.json(
        { error: "A class with this name already exists" },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await db.class.update({ where: { id }, data });
    return NextResponse.json({ class: updated });
  } catch {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }
}

/**
 * DELETE /api/admin/classes/[id]
 * Deletes a class. Cascade removes subjects → topics → questions
 * automatically (configured in schema.prisma).
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  try {
    await db.class.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }
}
