import { PrismaClient } from "@prisma/client";
const db = new PrismaClient({ datasources: { db: { url: "file:/home/z/my-project/db/backups/custom.db.pre-bulk-publish-20261010T150824Z" } } });
async function main() {
  const count = await db.question.count();
  const published = await db.question.count({ where: { status: "published" }});
  const draft = await db.question.count({ where: { status: "draft" }});
  const users = await db.user.count();
  const attempts = await db.quizAttempt.count();
  console.log(`Backup verified: ${count} questions (${published} published, ${draft} draft), ${users} users, ${attempts} attempts`);
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
