import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { ADMIN_ACTIONS } from "@/lib/admin-activity";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/questions/[id]
 */
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const question = await db.question.findUnique({
    where: { id },
    include: {
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
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  return NextResponse.json({ question });
}

const UpdateQuestionSchema = z.object({
  topicId: z.string().min(1).optional(),
  questionText: z.string().min(1).max(2000).optional(),
  optionA: z.string().min(1).max(500).optional(),
  optionB: z.string().min(1).max(500).optional(),
  optionC: z.string().min(1).max(500).optional(),
  optionD: z.string().min(1).max(500).optional(),
  correctOption: z.enum(["A", "B", "C", "D"]).optional(),
  explanation: z.string().max(2000).optional().nullable(),
  status: z.enum(["draft", "published"]).optional(),
  questionImage: z.string().optional().nullable(),
  optionAImage: z.string().optional().nullable(),
  optionBImage: z.string().optional().nullable(),
  optionCImage: z.string().optional().nullable(),
  optionDImage: z.string().optional().nullable(),
});

/**
 * PATCH /api/admin/questions/[id]
 *
 * Updates a question. Supports partial updates. The `status` field can
 * be flipped between "draft" and "published" through this endpoint,
 * which is how the publish/unpublish action works.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  // Trim text fields if present
  if (data.questionText !== undefined) data.questionText = data.questionText.trim();
  if (data.optionA !== undefined) data.optionA = data.optionA.trim();
  if (data.optionB !== undefined) data.optionB = data.optionB.trim();
  if (data.optionC !== undefined) data.optionC = data.optionC.trim();
  if (data.optionD !== undefined) data.optionD = data.optionD.trim();
  if (data.explanation !== undefined) {
    data.explanation = data.explanation?.trim() || null;
  }
  // Convert empty image strings to null (allows clearing an image)
  if (data.questionImage !== undefined) data.questionImage = data.questionImage || null;
  if (data.optionAImage !== undefined) data.optionAImage = data.optionAImage || null;
  if (data.optionBImage !== undefined) data.optionBImage = data.optionBImage || null;
  if (data.optionCImage !== undefined) data.optionCImage = data.optionCImage || null;
  if (data.optionDImage !== undefined) data.optionDImage = data.optionDImage || null;

  // Verify topic exists if changing
  if (data.topicId) {
    const topic = await db.topic.findUnique({
      where: { id: data.topicId },
      select: { id: true },
    });
    if (!topic) {
      return NextResponse.json(
        { error: "Selected topic does not exist" },
        { status: 400 }
      );
    }
  }

  // Capture pre-update status so we can log status transitions specifically.
  let previousStatus: string | undefined;
  if (data.status !== undefined) {
    const existing = await db.question.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    previousStatus = existing.status;
  }

  try {
    const updated = await db.question.update({
      where: { id },
      data,
      include: {
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
    });

    // Log status transitions distinctly so the activity feed is informative.
    if (data.status && data.status !== previousStatus) {
      try {
        await db.adminActivity.create({
          data: {
            adminId: user.id,
            action:
              data.status === "published"
                ? ADMIN_ACTIONS.QUESTION_PUBLISHED
                : ADMIN_ACTIONS.QUESTION_UNPUBLISHED,
            entity: "Question",
            entityId: id,
            description: `${data.status === "published" ? "Published" : "Unpublished"} question: ${updated.questionText.slice(0, 80)}`,
          },
        });
      } catch {
        // ignore logging failures
      }
    }

    return NextResponse.json({ question: updated });
  } catch {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
}

/**
 * DELETE /api/admin/questions/[id]
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  try {
    await db.question.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
}
