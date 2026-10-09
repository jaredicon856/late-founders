// Creates a demo member for local testing: demo@latefounders.com.
// Password comes from SEED_PASSWORD (default "late-founders-demo").
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = "demo@latefounders.com";
  const password = process.env.SEED_PASSWORD || "late-founders-demo";
  await db.user.upsert({
    where: { email },
    create: { email, name: "Dana", passwordHash: await bcrypt.hash(password, 12) },
    update: {},
  });
  console.log(`Demo member ready: ${email} / ${password}`);
}

main().finally(() => db.$disconnect());
