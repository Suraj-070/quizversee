import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/student/academic-profile
 * Returns the student's current class + selected subjects + onboarding status.
 */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const userRecord = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      currentClassId: true,
      onboardingCompleted: true,
      selectedSubjects: {
        select: {
          subjectId: true,
          subject: {
            select: {
              id: true, name: true, description: true, icon: true,
              class: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!userRecord) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    currentClassId: userRecord.currentClassId,
    onboardingCompleted: userRecord.onboardingCompleted,
    subjects: userRecord.selectedSubjects.map((s) => s.subject),
  });
}

const SaveSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  subjectIds: z.array(z.string()).optional().default([]),
});

/**
 * POST /api/student/academic-profile
 * Saves the student's academic profile (class + selected subjects).
 */
export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { classId, subjectIds } = parsed.data;

  const klass = await db.class.findFirst({
    where: { id: classId, isActive: true, archivedAt: null },
  });
  if (!klass) {
    return NextResponse.json({ error: "Invalid class" }, { status: 400 });
  }

  if (subjectIds.length > 0) {
    const validSubjects = await db.subject.findMany({
      where: {
        id: { in: subjectIds },
        classId,
        isActive: true,
        archivedAt: null,
        topics: { some: { isActive: true, archivedAt: null, contentType: "curriculum" } },
      },
      select: { id: true },
    });
    if (validSubjects.length !== subjectIds.length) {
      return NextResponse.json(
        { error: "One or more subjects are invalid" },
        { status: 400 }
      );
    }
  }

  // Keep grade and subject selection consistent if any write fails.
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { currentClassId: classId, onboardingCompleted: true },
    });
    await tx.userSubject.deleteMany({ where: { userId: user.id } });
    if (subjectIds.length > 0) {
      await tx.userSubject.createMany({
        data: subjectIds.map((subjectId) => ({ userId: user.id, subjectId })),
      });
    }
  });

  return NextResponse.json({ success: true, classId, subjectIds });
}
