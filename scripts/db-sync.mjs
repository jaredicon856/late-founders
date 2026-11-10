// Creates or updates the database tables during deploy, then locks every
// table against Supabase's public Data API (see prisma/rls.sql). Skips when
// no database is configured yet. `prisma db push` refuses changes that would
// delete data, so a destructive schema change fails the deploy instead of
// dropping member work.
//
// Then makes sure the first admin exists. BOOTSTRAP_ADMIN_EMAIL and
// BOOTSTRAP_ADMIN_PASSWORD_HASH (a bcrypt hash, never the password) live in
// the Vercel environment: the account is created once with that password, and
// on later deploys only its admin role is reapplied; its password is left alone.
import { execSync } from "node:child_process";

if (!process.env.DIRECT_URL || !process.env.DATABASE_URL) {
  console.log("db-sync: DATABASE_URL / DIRECT_URL not set, skipping table sync");
  process.exit(0);
}
execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
execSync("npx prisma db execute --file prisma/rls.sql --schema prisma/schema.prisma", { stdio: "inherit" });
console.log("db-sync: tables in sync, row level security on");

const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
const hash = process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH ?? "";
if (email && /^\$2[aby]\$\d\d\$/.test(hash)) {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) await db.user.update({ where: { email }, data: { role: "admin", disabled: false } });
    else await db.user.create({ data: { email, name: "Late Founders", lastName: "Admin", passwordHash: hash, role: "admin" } });
    console.log(`db-sync: first admin ${existing ? "confirmed" : "created"}`);
  } finally {
    await db.$disconnect();
  }
}
