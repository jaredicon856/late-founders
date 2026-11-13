import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// The database has moved to the Late Founders Supabase project. Until the app
// itself moves to Late Founders' Vercel (where DATABASE_URL will point there
// directly), MIGRATE_TO_DATABASE_URL holds that address and wins.
const moved = process.env.MIGRATE_TO_DATABASE_URL;
export const db = globalForPrisma.prisma ?? new PrismaClient(moved ? { datasourceUrl: moved } : undefined);
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
