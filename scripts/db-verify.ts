import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const q = await db.question.count();
  const published = await db.question.count({ where: { status: "published" }});
  const draft = await db.question.count({ where: { status: "draft" }});
  const users = await db.user.count();
  const attempts = await db.quizAttempt.count();
  const answers = await db.userAnswer.count();
  const classes = await db.class.count();
  const subjects = await db.subject.count();
  const topics = await db.topic.count();
  console.log(`Questions: ${q} (${published} published, ${draft} draft)`);
  console.log(`Users: ${users}, Attempts: ${attempts}, Answers: ${answers}`);
  console.log(`Classes: ${classes}, Subjects: ${subjects}, Topics: ${topics}`);
  // Check for any leftover test data
  const testQs = await db.question.count({ where: { questionText: { startsWith: "_Test" } } });
  const testClasses = await db.class.count({ where: { name: { startsWith: "_TEST_BULK_" } } });
  console.log(`Leftover test data: ${testQs} questions, ${testClasses} classes`);
  await db.$disconnect();
}
main();
