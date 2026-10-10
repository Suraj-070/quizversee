import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const admins = await db.user.findMany({ where: { role: "admin" }, select: { id: true, email: true, name: true }});
console.log("Admins:", JSON.stringify(admins, null, 2));
await db.$disconnect();
