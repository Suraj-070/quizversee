/**
 * Shared TypeScript types for the MCQ platform.
 * Most entity types are derived from Prisma, but we keep a few hand-written
 * types here for client-side use where we don't want to leak the full Prisma
 * model (e.g. omitting `passwordHash` from the User type).
 */

export type Role = "user" | "admin";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
};

export type AcademicClass = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
};

export type AcademicSubject = {
  id: string;
  classId: string;
  name: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  displayOrder: number;
};

export type AcademicTopic = {
  id: string;
  subjectId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
};

export type QuestionStatus = "draft" | "published";

export type Question = {
  id: string;
  topicId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string | null;
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
};

/**
 * A question as seen by the client during an active quiz.
 * Critically, `correctOption` is NOT included — it's only revealed
 * after the user submits an answer for that question.
 */
export type QuizQuestionClient = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  explanation: string | null;
};

export type QuizAttempt = {
  id: string;
  userId: string;
  topicId: string | null;
  quizSetId: string | null;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  startedAt: string;
  completedAt: string | null;
};

export type UserAnswer = {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D";
  isCorrect: boolean;
  answeredAt: string;
};
