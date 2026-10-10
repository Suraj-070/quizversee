import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // Check indexes auto-created by sqlite for primary keys / unique
  const allIdx = await db.$queryRawUnsafe<any[]>(
    "SELECT name, tbl_name FROM sqlite_master WHERE type='index' ORDER BY tbl_name, name"
  );
  console.log("ALL INDEXES:");
  for (const i of allIdx) console.log(`  ${i.tbl_name}.${i.name}`);
  // Check sample importHistory
  const hist = await db.importHistory.findMany({ take: 5, orderBy: { createdAt: "desc" }});
  console.log("\nImportHistory (last 5):");
  for (const h of hist) console.log(`  ${h.id} | ${h.filename} | topic=${h.topicName} | imported=${h.imported} failed=${h.failed} | ${h.createdAt.toISOString()}`);
  // Sample Question.sourceName distribution
  const bySource = await db.question.groupBy({ by: ["sourceName"], _count: true });
  console.log("\nBy sourceName:", bySource);
  // Look for a recent large question import batch
  const recentQ = await db.question.findMany({
    where: { sourceType: "dataset" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, sourceQuestionId: true, sourceName: true, status: true, createdAt: true, questionText: true }
  });
  console.log("\nRecent dataset questions:");
  for (const q of recentQ) console.log(`  ${q.id} | src=${q.sourceQuestionId} | ${q.sourceName} | ${q.status} | ${q.questionText.slice(0,60)}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
