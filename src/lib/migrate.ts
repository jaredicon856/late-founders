// Move of every table from the old database (DATABASE_URL) to the Late
// Founders one (MIGRATE_TO_DIRECT_URL). The app now runs on the new database
// (see db.ts), so "copy" is switched off: it would overwrite live member work
// with the old copy. "check" counts rows on both sides, to confirm nothing
// was saved to the old database during the switch.

import { PrismaClient } from "@prisma/client";

// Parents before children (foreign keys).
const TABLES = [
  "user", "session", "passwordReset", "profileField", "assetState", "assetVersion",
  "message", "sop", "sopVersion", "course", "material", "notice",
] as const;
type Table = (typeof TABLES)[number];
// Rows per batch: small for tables that hold files or long transcripts.
const BATCH: Partial<Record<Table, number>> = { material: 5, assetVersion: 100, message: 200 };

type Delegate = {
  count: () => Promise<number>;
  findMany: (a: object) => Promise<{ id: string }[]>;
  createMany: (a: { data: object[] }) => Promise<unknown>;
  deleteMany: () => Promise<unknown>;
};
const table = (c: PrismaClient, t: Table) => (c as unknown as Record<Table, Delegate>)[t];

export function migrateTarget(): string | null {
  return process.env.MIGRATE_TO_DIRECT_URL || null;
}

async function counts(c: PrismaClient) {
  const out: Record<string, number> = {};
  for (const t of TABLES) out[t] = await table(c, t).count();
  return out;
}

export async function runMigration(mode: "check" | "copy") {
  const url = migrateTarget();
  if (!url) throw new Error("MIGRATE_TO_DIRECT_URL is not set.");
  if (mode === "copy") throw new Error("The app already runs on the new database; copying again would overwrite member work.");
  const source = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  const target = new PrismaClient({ datasourceUrl: url });
  try {
    if (false as boolean) {
      for (const t of [...TABLES].reverse()) await table(target, t).deleteMany();
      for (const t of TABLES) {
        const size = BATCH[t] ?? 500;
        let cursor: string | undefined;
        for (;;) {
          const rows = await table(source, t).findMany({ take: size, orderBy: { id: "asc" }, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) });
          if (!rows.length) break;
          await table(target, t).createMany({ data: rows });
          cursor = rows[rows.length - 1].id;
          if (rows.length < size) break;
        }
      }
    }
    const [from, to] = await Promise.all([counts(source), counts(target)]);
    const same = TABLES.every((t) => from[t] === to[t]);
    return { mode, same, from, to };
  } finally {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
  }
}
