import { db } from "@/lib/db";

// Caps how many messages one member can send the Assistant in any 24 hours,
// so a leaked sign-up code can't run up the Claude bill.
const DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_DAILY_LIMIT = 100;

export function dailyLimit(raw = process.env.ASSISTANT_DAILY_LIMIT): number {
  const n = Number(raw);
  return raw && Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_DAILY_LIMIT;
}

export function limitMessage(limit: number, oldest: Date, now = new Date()): string {
  const hours = Math.max(1, Math.ceil((oldest.getTime() + DAY - now.getTime()) / 3_600_000));
  return `You've sent ${limit} messages to the Assistant in the last 24 hours, which is the daily limit. You can send more in about ${hours} hour${hours === 1 ? "" : "s"}. Everything so far is saved.`;
}

// Returns a message to show the member when they are over the cap, else null.
// Counts only what the member typed: tool round-trips and the hidden opener don't count.
export async function overDailyLimit(userId: string, now = new Date()): Promise<string | null> {
  const limit = dailyLimit();
  const where = { userId, role: "user", hidden: false, createdAt: { gte: new Date(now.getTime() - DAY) } };
  if ((await db.message.count({ where })) < limit) return null;
  const oldest = await db.message.findFirst({ where, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  return limitMessage(limit, oldest?.createdAt ?? now, now);
}
