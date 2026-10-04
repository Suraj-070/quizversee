import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/questions
 *
 * Query params:
 *   - classId   — filter by parent class
 *   - subjectId — filter by parent subject
 *   - topicId   — filter by topic
 *   - status    — "draft" | "published"
 *   - search    — search question text
 *
 * Returns questions joined with their topic → subject → class chain for
 * display in the admin table.
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const subjectId = url.searchParams.get("subjectId");
  const topicId = url.searchParams.get("topicId");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  const where: {
    topicId?: string;
    status?: string;
    questionText?: { contains: string };
    topic?: { subjectId?: string; subject?: { classId?: string } };
  } = {};

  if (topicId) where.topicId = topicId;
  if (status && (status === "draft" || status === "published")) {
    where.status = status;
  }
  if (search) where.questionText = { contains: search };
  if (subjectId || classId) {
    where.topic = {};
    if (subjectId) where.topic.subjectId = subjectId;
    if (classId) where.topic.subject = { classId };
  }

  const questions = await db.question.findMany({
    where,
    orderBy: { createdAt: "desc" },
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

  return NextResponse.json({ questions });
}

const CreateQuestionSchema = z.object({
  topicId: z.string().min(1, "Topic is required"),
  questionText: z.string().min(1, "Question text is required").max(2000),
  optionA: z.string().min(1, "Option A is required").max(500),
  optionB: z.string().min(1, "Option B is required").max(500),
  optionC: z.string().min(1, "Option C is required").max(500),
  optionD: z.string().min(1, "Option D is required").max(500),
  correctOption: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().max(2000).optional().nullable(),
  status: z.enum(["draft", "published"]).optional().default("draft"),
  // Optional image fields (base64 data URIs). When set, the option or
  // question renders with the image.
  questionImage: z.string().optional().nullable(),
  optionAImage: z.string().optional().nullable(),
  optionBImage: z.string().optional().nullable(),
  optionCImage: z.string().optional().nullable(),
  optionDImage: z.string().optional().nullable(),
});

/**
 * POST /api/admin/questions
 * Creates a new question.
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = CreateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const {
    topicId,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    explanation,
    status,
    questionImage,
    optionAImage,
    optionBImage,
    optionCImage,
    optionDImage,
  } = parsed.data;

  // Verify the parent topic exists
  const topic = await db.topic.findUnique({
    where: { id: topicId },
    select: { id: true },
  });
  if (!topic) {
    return NextResponse.json(
      { error: "Selected topic does not exist" },
      { status: 400 }
    );
  }

  const question = await db.question.create({
    data: {
      topicId,
      questionText: questionText.trim(),
      optionA: optionA.trim(),
      optionB: optionB.trim(),
      optionC: optionC.trim(),
      optionD: optionD.trim(),
      correctOption,
      explanation: explanation?.trim() || null,
      status,
      questionImage: questionImage || null,
      optionAImage: optionAImage || null,
      optionBImage: optionBImage || null,
      optionCImage: optionCImage || null,
      optionDImage: optionDImage || null,
    },
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

  return NextResponse.json({ question }, { status: 201 });
}
