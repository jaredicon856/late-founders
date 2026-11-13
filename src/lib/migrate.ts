// One-time move of every table to a new database (MIGRATE_TO_DIRECT_URL),
// used to hand the app over to another Supabase project. The target's tables
// are created at deploy by scripts/db-sync.mjs. "check" only counts rows on
// both sides; "copy" empties the target and copies everything, parents first,
// then counts again so the result can be compared table by table.

import { PrismaClient } from "@prisma/client";
import { db } from "./db";

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
  const target = new PrismaClient({ datasourceUrl: url });
  try {
    if (mode === "copy") {
      for (const t of [...TABLES].reverse()) await table(target, t).deleteMany();
      for (const t of TABLES) {
        const size = BATCH[t] ?? 500;
        let cursor: string | undefined;
        for (;;) {
          const rows = await table(db, t).findMany({ take: size, orderBy: { id: "asc" }, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) });
          if (!rows.length) break;
          await table(target, t).createMany({ data: rows });
          cursor = rows[rows.length - 1].id;
          if (rows.length < size) break;
        }
      }
    }
    const [from, to] = await Promise.all([counts(db), counts(target)]);
    const same = TABLES.every((t) => from[t] === to[t]);
    return { mode, same, from, to };
  } finally {
    await target.$disconnect();
  }
}
