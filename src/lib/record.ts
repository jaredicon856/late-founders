// Member record access. Every asset goes through these two functions, so the
// "one member record" rule is enforced in one place.

import type { ProfileData } from "@/content/types";
import { db, parseJson } from "./db";

export async function getProfile(userId: string, keys?: string[]): Promise<ProfileData> {
  const rows = await db.profileField.findMany({
    where: { userId, ...(keys ? { key: { in: keys } } : {}) },
  });
  const out: ProfileData = {};
  for (const r of rows) out[r.key] = parseJson(r.valueJson, null);
  return out;
}

export async function writeProfile(userId: string, values: Record<string, unknown>, source: string) {
  const entries = Object.entries(values).filter(([, v]) => v !== undefined);
  await db.$transaction(
    entries.map(([key, v]) =>
      db.profileField.upsert({
        where: { userId_key: { userId, key } },
        create: { userId, key, valueJson: JSON.stringify(v), source },
        update: { valueJson: JSON.stringify(v), source },
      }),
    ),
  );
}
