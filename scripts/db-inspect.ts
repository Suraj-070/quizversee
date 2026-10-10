import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const tables = await db.$queryRawUnsafe<any[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name"
  );
  console.log("TABLES:", tables.map((t) => t.name).join(", "));
  const indexes = await db.$queryRawUnsafe<any[]>(
    "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name"
  );
  console.log("\nINDEXES (custom, not auto-created):");
  for (const i of indexes) console.log(`  ${i.tbl_name}.${i.name}`);
  const qCount = await db.question.count();
  console.log(`\nQuestion count: ${qCount}`);
  const byStatus = await db.question.groupBy({ by: ["status"], _count: true });
  console.log("By status:", byStatus);
  const bySource = await db.question.groupBy({ by: ["sourceType"], _count: true });
  console.log("By sourceType:", bySource);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
