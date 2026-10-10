/**
 * Seed script for the Dynamic MCQ Learning Platform.
 *
 * Run with: `bun run scripts/seed.ts`
 *
 * Idempotent: re-running it will not duplicate data; it updates existing
 * records in place. Safe to run multiple times during development.
 *
 * Seeds:
 *   - 1 admin user (admin@mcq.local / admin12345)
 *   - 1 student user (student@mcq.local / student12345)
 *   - 1 class (Class 9) — ACTIVE
 *   - 1 subject (Science) — ACTIVE
 *   - 1 topic (Force and Motion) — ACTIVE
 *   - 6 sample questions on Force and Motion — PUBLISHED
 *   - Setting: quiz_question_counts = [10, 20, 30, 40, 50]
 *
 * NOTE: This seed data is for DEVELOPMENT ONLY. The real question bank
 * will be added later through the Admin Portal. The application is NOT
 * designed around these specific rows — they exist purely to verify the
 * system works end-to-end.
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function upsertUser(args: {
  email: string;
  name: string;
  password: string;
  role: "user" | "admin";
}) {
  const passwordHash = await bcrypt.hash(args.password, 10);
  const existing = await db.user.findUnique({ where: { email: args.email } });
  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: { name: args.name, passwordHash, role: args.role },
    });
  }
  return db.user.create({
    data: { email: args.email, name: args.name, passwordHash, role: args.role },
  });
}

async function findOrCreateClass(args: {
  name: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
}) {
  const existing = await db.class.findFirst({ where: { name: args.name } });
  if (existing) {
    return db.class.update({
      where: { id: existing.id },
      data: {
        description: args.description,
        isActive: args.isActive,
        displayOrder: args.displayOrder,
      },
    });
  }
  return db.class.create({ data: args });
}

async function findOrCreateSubject(args: {
  classId: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
  displayOrder: number;
}) {
  const existing = await db.subject.findFirst({
    where: { classId: args.classId, name: args.name },
  });
  if (existing) {
    return db.subject.update({
      where: { id: existing.id },
      data: {
        description: args.description,
        icon: args.icon,
        isActive: args.isActive,
        displayOrder: args.displayOrder,
      },
    });
  }
  return db.subject.create({ data: args });
}

async function findOrCreateTopic(args: {
  subjectId: string;
  name: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
}) {
  const existing = await db.topic.findFirst({
    where: { subjectId: args.subjectId, name: args.name },
  });
  if (existing) {
    return db.topic.update({
      where: { id: existing.id },
      data: {
        description: args.description,
        isActive: args.isActive,
        displayOrder: args.displayOrder,
      },
    });
  }
  return db.topic.create({ data: args });
}

async function main() {
  console.log("→ Seeding users…");
  const admin = await upsertUser({
    email: "admin@mcq.local",
    name: "Admin User",
    password: "admin12345",
    role: "admin",
  });
  const student = await upsertUser({
    email: "student@mcq.local",
    name: "Test Student",
    password: "student12345",
    role: "user",
  });
  console.log(`  admin:   ${admin.email} (id=${admin.id})`);
  console.log(`  student: ${student.email} (id=${student.id})`);

  console.log("→ Seeding academic hierarchy…");
  const klass = await findOrCreateClass({
    name: "Class 9",
    description: "Class 9 — sample seeded for development.",
    isActive: true,
    displayOrder: 1,
  });

  const subject = await findOrCreateSubject({
    classId: klass.id,
    name: "Science",
    description: "Science — sample seeded for development.",
    icon: "flask-conical",
    isActive: true,
    displayOrder: 1,
  });

  const topic = await findOrCreateTopic({
    subjectId: subject.id,
    name: "Force and Motion",
    description: "Newton's laws, units of force, basic motion.",
    isActive: true,
    displayOrder: 1,
  });
  console.log(`  class:   ${klass.name} (id=${klass.id})`);
  console.log(`  subject: ${subject.name} (id=${subject.id})`);
  console.log(`  topic:   ${topic.name} (id=${topic.id})`);

  console.log("→ Seeding 6 sample questions…");
  // Delete existing questions for this topic, then re-insert. Keeps the seed
  // idempotent without requiring a unique constraint on question text.
  await db.question.deleteMany({ where: { topicId: topic.id } });

  const sampleQuestions = [
    {
      questionText: "What is the SI unit of force?",
      optionA: "Joule",
      optionB: "Newton",
      optionC: "Watt",
      optionD: "Pascal",
      correctOption: "B",
      explanation: "Force is measured in newtons (N). 1 N = 1 kg·m/s².",
    },
    {
      questionText:
        "Which of Newton's laws states that an object in motion stays in motion unless acted upon by an external force?",
      optionA: "First law (law of inertia)",
      optionB: "Second law (F = ma)",
      optionC: "Third law (action–reaction)",
      optionD: "Law of gravitation",
      correctOption: "A",
      explanation:
        "Newton's first law is the law of inertia: an object's velocity remains constant unless a net force acts on it.",
    },
    {
      questionText:
        "If a 2 kg object accelerates at 3 m/s², what net force is acting on it?",
      optionA: "3 N",
      optionB: "5 N",
      optionC: "6 N",
      optionD: "9 N",
      correctOption: "C",
      explanation: "F = ma = 2 kg × 3 m/s² = 6 N (Newton's second law).",
    },
    {
      questionText:
        "For every action, there is an equal and opposite reaction. This is Newton's:",
      optionA: "First law",
      optionB: "Second law",
      optionC: "Third law",
      optionD: "Zeroth law",
      correctOption: "C",
      explanation:
        "Newton's third law: every action has an equal and opposite reaction.",
    },
    {
      questionText: "Which quantity is a vector?",
      optionA: "Mass",
      optionB: "Time",
      optionC: "Speed",
      optionD: "Velocity",
      correctOption: "D",
      explanation:
        "Velocity has both magnitude and direction, so it is a vector. Mass, time, and speed are scalars.",
    },
    {
      questionText:
        "A book resting on a table is in equilibrium. The table exerts an upward force on the book called the:",
      optionA: "Gravitational force",
      optionB: "Normal force",
      optionC: "Frictional force",
      optionD: "Tension force",
      correctOption: "B",
      explanation:
        "The normal force is the perpendicular contact force exerted by the surface on the book, balancing gravity.",
    },
  ];

  for (const q of sampleQuestions) {
    await db.question.create({
      data: {
        topicId: topic.id,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        explanation: q.explanation,
        status: "published",
      },
    });
  }
  console.log(`  inserted ${sampleQuestions.length} published questions`);

  console.log("→ Seeding settings…");
  await db.setting.upsert({
    where: { key: "quiz_question_counts" },
    update: { value: JSON.stringify([10, 20, 30, 40, 50]) },
    create: {
      key: "quiz_question_counts",
      value: JSON.stringify([10, 20, 30, 40, 50]),
    },
  });
  console.log("  quiz_question_counts = [10, 20, 30, 40, 50]");

  console.log("\n✅ Seed complete.");
  console.log("   Admin login:    admin@mcq.local / admin12345");
  console.log("   Student login:  student@mcq.local / student12345");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
