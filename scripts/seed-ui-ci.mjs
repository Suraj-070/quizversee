import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Safety: this script ONLY runs in GitHub CI with the named disposable SQLite DB.
if (process.env.CI !== "true" || process.env.DATABASE_URL !== "file:./ui-smoke.sqlite") {
  throw new Error("Refusing to seed anything except CI's disposable ui-smoke.sqlite");
}

const db = new PrismaClient();
try {
  const passwordHash = await bcrypt.hash("CiTest-only-2026!", 10);
  await db.class.create({
    data: {
      id: "ci-class-9", name: "Class 9", isActive: true,
      subjects: {
        create: [{
          id: "ci-science", name: "Science", isActive: true,
          topics: {
            create: [
              {
                id: "ci-cells", name: "Cells", isActive: true, contentType: "curriculum",
                questions: {
                  create: [
                    { id: "ci-q1", questionText: "The basic unit of life is?", optionA: "Cell", optionB: "Atom", optionC: "Organ", optionD: "Mineral", correctOption: "A", status: "published", contentType: "curriculum", explanation: "Cells are the basic unit of life." },
                    { id: "ci-q2", questionText: "A cell membrane is?", optionA: "Rigid", optionB: "Selective", optionC: "Invisible", optionD: "Absent", correctOption: "B", status: "published", contentType: "curriculum", explanation: "Membranes regulate transport." },
                    // Cross-category data should never leak into My Learning.
                    { id: "ci-cross", questionText: "Wrong category question", optionA: "One", optionB: "Two", optionC: "Three", optionD: "Four", correctOption: "A", status: "published", contentType: "extra_practice" },
                  ],
                },
              },
              {
                id: "ci-extra", name: "Science Challenge", isActive: true, contentType: "extra_practice",
                questions: {
                  create: [
                    { id: "ci-q-extra", questionText: "Supplementary challenge?", optionA: "One", optionB: "Two", optionC: "Three", optionD: "Four", correctOption: "A", status: "published", contentType: "extra_practice" },
                  ],
                },
              },
            ],
          },
        }],
      },
    },
  });
  await db.user.create({
    data: {
      id: "ci-student", name: "CI Student", email: "ci-student@example.test",
      passwordHash, role: "user", currentClassId: "ci-class-9", onboardingCompleted: true,
      selectedSubjects: { create: [{ subjectId: "ci-science" }] },
    },
  });
  await db.user.create({
    data: {
      id: "ci-admin", name: "CI Admin", email: "ci-admin@example.test",
      passwordHash, role: "admin", onboardingCompleted: true,
    },
  });
  await db.setting.create({ data: { key: "quiz_question_counts", value: "[1,2,10]" } });
  console.log("Seeded disposable CI database; no production data accessed.");
} finally {
  await db.$disconnect();
}
