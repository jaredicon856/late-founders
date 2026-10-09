// Creates or updates the database tables during deploy, then locks every
// table against Supabase's public Data API (see prisma/rls.sql). Skips when
// no database is configured yet. `prisma db push` refuses changes that would
// delete data, so a destructive schema change fails the deploy instead of
// dropping member work.
import { execSync } from "node:child_process";

if (!process.env.DIRECT_URL || !process.env.DATABASE_URL) {
  console.log("db-sync: DATABASE_URL / DIRECT_URL not set, skipping table sync");
  process.exit(0);
}
execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
execSync("npx prisma db execute --file prisma/rls.sql --schema prisma/schema.prisma", { stdio: "inherit" });
console.log("db-sync: tables in sync, row level security on");
