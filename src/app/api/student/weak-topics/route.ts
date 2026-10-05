import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/student/weak-topics
 *
 * Finds topics where the student's performance is below 60% correct rate.
 * Uses existing QuestionMastery data (timesSeen, timesCorrect).
 *
 * Only surfaces a topic as "weak" if the student has answered at least
 * 5 questions from it (to avoid false signals from tiny samples).
 */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const mastery = await db.questionMastery.findMany({
    where: { userId: user.id, timesSeen: { gte: 3 } },
    select: {
      questionId: true,
      timesSeen: true,
      timesCorrect: true,
      question: {
        select: {
          topicId: true,
          topic: {
            select: {
              id: true, name: true,
              subject: {
                select: {
                  id: true, name: true,
                  class: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const topicMap = new Map<string, {
    topicId: string; topicName: string; subjectId: string;
    subjectName: string; className: string;
    totalSeen: number; totalCorrect: number; correctRate: number;
  }>();

  for (const m of mastery) {
    const topic = m.question.topic;
    if (!topic) continue;
    const existing = topicMap.get(topic.id);
    if (existing) {
      existing.totalSeen += m.timesSeen;
      existing.totalCorrect += m.timesCorrect;
    } else {
      topicMap.set(topic.id, {
        topicId: topic.id, topicName: topic.name,
        subjectId: topic.subject.id, subjectName: topic.subject.name,
        className: topic.subject.class.name,
        totalSeen: m.timesSeen, totalCorrect: m.timesCorrect, correctRate: 0,
      });
    }
  }

  const weakTopics = Array.from(topicMap.values())
    .map((t) => ({
      ...t,
      correctRate: t.totalSeen > 0 ? Math.round((t.totalCorrect / t.totalSeen) * 100) : 0,
    }))
    .filter((t) => t.totalSeen >= 5 && t.correctRate < 60)
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 5);

  return NextResponse.json({ weakTopics });
}
