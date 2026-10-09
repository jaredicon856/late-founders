// Creates or updates the database tables during deploy. Skips when no
// database is configured yet. `prisma db push` refuses changes that would
// delete data, so a destructive schema change fails the deploy instead of
// dropping member work.
import { execSync } from "node:child_process";

if (!process.env.DIRECT_URL || !process.env.DATABASE_URL) {
  console.log("db-sync: DATABASE_URL / DIRECT_URL not set, skipping table sync");
  process.exit(0);
}
execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
