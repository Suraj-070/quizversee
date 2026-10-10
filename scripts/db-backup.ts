/**
 * SQLite Online Backup utility.
 *
 * Uses Prisma's underlying SQLite driver via the 'better-sqlite3'-style
 * Online Backup API exposed through $executeRawUnsafe. Because Prisma
 * doesn't directly expose the sqlite3_backup_* C API, we use the simpler
 * VACUUM INTO approach (SQLite ≥ 3.27) which produces a transactionally
 * consistent snapshot without locking writers for the entire duration.
 *
 * Usage:
 *   bun run scripts/db-backup.ts [label]
 *
 * Output: /home/z/my-project/db/backups/custom.db.<label-or-timestamp>
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, existsSync, statSync } from "fs";
import path from "path";

const db = new PrismaClient();

async function main() {
  const label = process.argv[2] || `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const backupDir = "/home/z/my-project/db/backups";
  mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `custom.db.${label}`);

  if (existsSync(backupPath)) {
    console.error(`Backup already exists: ${backupPath}`);
    process.exit(1);
  }

  const sourceUrl = process.env.DATABASE_URL || "file:/home/z/my-project/db/custom.db";
  console.log(`Source: ${sourceUrl}`);
  console.log(`Backup target: ${backupPath}`);

  // VACUUM INTO is a SQLite ≥3.27 feature that creates a consistent snapshot.
  // It does NOT lock writers for the entire operation (uses page-level copies
  // inside a single transaction). Safe for production use on small/medium DBs.
  await db.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

  const stat = statSync(backupPath);
  console.log(`Backup OK: ${(stat.size / 1024).toFixed(1)} KB`);

  // Verify by reading the backup
  const verifyDb = new PrismaClient({
    datasources: { db: { url: `file:${backupPath}` } },
  });
  const qCount = await verifyDb.question.count();
  const uCount = await verifyDb.user.count();
  const aCount = await verifyDb.quizAttempt.count();
  console.log(`Verified: ${qCount} questions, ${uCount} users, ${aCount} attempts`);
  await verifyDb.$disconnect();
  await db.$disconnect();
}

main().catch((e) => {
  console.error("Backup failed:", e);
  process.exit(1);
});
