/**
 * Phase 5+6 testing helper — adds 4 more published questions to
 * Force and Motion so the quiz can be tested with the default
 * allowed counts of [10, 20, 30, 40, 50].
 *
 * After this runs the topic will have 10 published questions, making
 * the "10" count available.
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const topic = await db.topic.findFirst({
    where: { name: "Force and Motion" },
    select: { id: true },
  });
  if (!topic) throw new Error("Topic not found");

  const extra = [
    {
      questionText: "What is the acceleration due to gravity on Earth (approx)?",
      optionA: "8.8 m/s²",
      optionB: "9.8 m/s²",
      optionC: "10.8 m/s²",
      optionD: "11.8 m/s²",
      correctOption: "B",
      explanation: "Standard gravity g ≈ 9.8 m/s² near Earth's surface.",
    },
    {
      questionText: "Which law explains why a passenger lurches forward when a car brakes suddenly?",
      optionA: "Newton's first law",
      optionB: "Newton's second law",
      optionC: "Newton's third law",
      optionD: "Law of conservation of mass",
      correctOption: "A",
      explanation: "Inertia (Newton's first law) keeps the passenger moving forward.",
    },
    {
      questionText: "The momentum of an object is the product of its mass and:",
      optionA: "Acceleration",
      optionB: "Velocity",
      optionC: "Force",
      optionD: "Time",
      correctOption: "B",
      explanation: "Momentum p = m × v.",
    },
    {
      questionText: "Which of these is NOT a contact force?",
      optionA: "Friction",
      optionB: "Tension",
      optionC: "Gravitational force",
      optionD: "Normal force",
      correctOption: "C",
      explanation: "Gravity acts at a distance — it does not require contact.",
    },
  ];

  for (const q of extra) {
    await db.question.create({
      data: { ...q, topicId: topic.id, status: "published" },
    });
  }
  const total = await db.question.count({
    where: { topicId: topic.id, status: "published" },
  });
  console.log(`Topic now has ${total} published questions.`);
}

main().finally(() => db.$disconnect());
