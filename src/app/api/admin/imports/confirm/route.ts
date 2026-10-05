import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { logAdminActivity, ADMIN_ACTIONS } from "@/lib/admin-activity";

/**
 * POST /api/admin/imports/confirm
 *
 * Receives the base64-encoded JSON from the preview step + the admin's
 * confirmation. Parses, validates again (safety), finds-or-creates the
 * Class/Subject/Topic hierarchy, and inserts valid questions.
 *
 * Body: { rawJson: string (base64) }
 */
export async function POST(request: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body?.rawJson) {
    return NextResponse.json({ error: "Missing rawJson" }, { status: 400 });
  }

  let raw: string;
  try {
    raw = Buffer.from(body.rawJson, "base64").toString("utf-8");
  } catch {
    return NextResponse.json({ error: "Invalid rawJson encoding" }, { status: 400 });
  }

  let data: {
    class: string;
    subject: string;
    topic: string;
    questions: Array<{
      question: string;
      questionImage: string | null;
      options: {
        A: { text: string; image: string | null };
        B: { text: string; image: string | null };
        C: { text: string; image: string | null };
        D: { text: string; image: string | null };
      };
      answer: string;
      explanation: string;
    }>;
  };

  try {
    data = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Find or create Class → Subject → Topic
  let klass = await db.class.findFirst({ where: { name: data.class, archivedAt: null } });
  if (!klass) {
    klass = await db.class.create({
      data: { name: data.class, isActive: true, displayOrder: 0 },
    });
  }

  let subject = await db.subject.findFirst({ where: { classId: klass.id, name: data.subject, archivedAt: null } });
  if (!subject) {
    subject = await db.subject.create({
      data: { classId: klass.id, name: data.subject, isActive: true, displayOrder: 0 },
    });
  }

  let topic = await db.topic.findFirst({ where: { subjectId: subject.id, name: data.topic, archivedAt: null } });
  if (!topic) {
    topic = await db.topic.create({
      data: { subjectId: subject.id, name: data.topic, isActive: true, displayOrder: 0 },
    });
  }

  // Delete existing questions for this topic (so re-imports don't duplicate)
  await db.question.deleteMany({ where: { topicId: topic.id } });

  // Insert valid questions
  let imported = 0;
  let failed = 0;
  let skipped = 0;
  const failures: Array<{ index: number; reason: string }> = [];

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];

    // Validate
    if (!q.question?.trim() || !q.answer || !["A", "B", "C", "D"].includes(q.answer)) {
      failed++;
      failures.push({ index: i + 1, reason: "Missing question text or invalid answer" });
      continue;
    }
    if (!q.options?.A?.text || !q.options?.B?.text || !q.options?.C?.text || !q.options?.D?.text) {
      failed++;
      failures.push({ index: i + 1, reason: "Missing option text" });
      continue;
    }

    try {
      await db.question.create({
        data: {
          topicId: topic.id,
          questionText: q.question.trim(),
          optionA: q.options.A.text,
          optionB: q.options.B.text,
          optionC: q.options.C.text,
          optionD: q.options.D.text,
          correctOption: q.answer,
          explanation: q.explanation?.trim() || null,
          status: "published",
          questionImage: q.questionImage || null,
          optionAImage: q.options.A.image || null,
          optionBImage: q.options.B.image || null,
          optionCImage: q.options.C.image || null,
          optionDImage: q.options.D.image || null,
        },
      });
      imported++;
    } catch (err) {
      failed++;
      failures.push({ index: i + 1, reason: "Database error during insert" });
    }
  }

  // Record import history
  const imagesCount = data.questions.filter((q) => q.questionImage).length;
  await db.importHistory.create({
    data: {
      filename: body.filename || "import.json",
      className: data.class,
      subjectName: data.subject,
      topicName: data.topic,
      imported,
      failed,
      skipped,
      imagesCount,
      adminId: user.id,
    },
  });

  // Log activity
  await logAdminActivity(
    user.id,
    ADMIN_ACTIONS.QUESTIONS_IMPORTED,
    "Question",
    topic.id,
    `Imported ${imported} ${data.topic} questions`
  );

  return NextResponse.json({
    success: true,
    imported,
    failed,
    skipped,
    imagesCount,
    failures,
    topicName: data.topic,
  });
}

/**
 * GET /api/admin/imports
 * Returns import history.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const history = await db.importHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      admin: { select: { name: true } },
    },
  });

  return NextResponse.json({ history });
}
