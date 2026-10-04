import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import ZAI from "z-ai-web-dev-sdk";

/**
 * POST /api/student/questions/[id]/ai-explanation
 *
 * Generates an AI-powered explanation for a question the student got
 * wrong. Uses the z-ai-web-dev-sdk LLM to create a clear, educational
 * explanation that addresses why the student's answer was incorrect and
 * why the correct answer is right.
 *
 * Caches the result in the AIExplanation table so we don't regenerate
 * for the same question + user.
 *
 * Body: { selectedOption: "A"|"B"|"C"|"D" }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id: questionId } = await params;

  const body = await request.json().catch(() => null);
  const selectedOption = body?.selectedOption as string;
  if (!selectedOption || !["A", "B", "C", "D"].includes(selectedOption)) {
    return NextResponse.json(
      { error: "selectedOption is required (A/B/C/D)" },
      { status: 400 }
    );
  }

  // Fetch the question
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      questionText: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      correctOption: true,
      explanation: true,
    },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // Check cache (per user + question)
  const cached = await db.aIExplanation.findUnique({
    where: { questionId_userId: { questionId, userId: user.id } },
  });
  if (cached) {
    return NextResponse.json({ explanation: cached.explanation, cached: true });
  }

  // Build the prompt
  const optionLabels: Record<string, string> = {
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  };

  const correctAnswer = optionLabels[question.correctOption];
  const studentAnswer = optionLabels[selectedOption];

  const systemPrompt =
    "You are an expert tutor. A student answered a multiple-choice question incorrectly. " +
    "Explain WHY their answer is wrong and WHY the correct answer is right. " +
    "Be clear, encouraging, and educational. Keep it under 150 words. " +
    "Do not reveal the letter of the correct answer — just explain the concept.";

  const userPrompt = `Question: ${question.questionText}

Options:
A. ${question.optionA}
B. ${question.optionB}
C. ${question.optionC}
D. ${question.optionD}

The student chose: ${selectedOption}. ${optionLabels[selectedOption]}
The correct answer is: ${question.correctOption}. ${correctAnswer}

${question.explanation ? `Existing explanation: ${question.explanation}` : ""}

Please provide a clear, educational explanation of why the student's answer is wrong and why the correct answer is right. Address the specific misconception if possible.`;

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    });

    const explanation = completion.choices[0]?.message?.content?.trim();
    if (!explanation) {
      throw new Error("AI returned an empty response");
    }

    // Cache it
    await db.aIExplanation.upsert({
      where: { questionId_userId: { questionId, userId: user.id } },
      update: { explanation },
      create: { questionId, userId: user.id, explanation },
    });

    return NextResponse.json({ explanation, cached: false });
  } catch (err) {
    console.error("[ai-explanation] error", err);
    return NextResponse.json(
      { error: "Failed to generate AI explanation. Please try again." },
      { status: 500 }
    );
  }
}
