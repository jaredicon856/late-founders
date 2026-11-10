// Data for the admin pages: one row per member with the numbers the team
// looks at (progress, last active, Assistant use), read in a few grouped
// queries rather than one per member.

import { ASSETS } from "@/content/catalog";
import { db, parseJson } from "./db";

// Accounts made by automated tests or for trying things out.
export const isTestEmail = (email: string) => /@example\.(com|org|net)$/i.test(email);

const DAY = 86_400_000;

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  disabled: boolean;
  test: boolean;
  createdAt: Date;
  lastSeenAt: Date | null;
  founderType: string;
  freedomNumber: number | null;
  done: number;
  doneIds: Set<string>;
  messagesToday: number;
  messagesMonth: number;
};

export async function memberRows(): Promise<MemberRow[]> {
  const since24h = new Date(Date.now() - DAY);
  const since30d = new Date(Date.now() - 30 * DAY);
  const [users, done, types, freedom, today, month] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, lastName: true, email: true, role: true, disabled: true, createdAt: true, lastSeenAt: true },
    }),
    db.assetState.findMany({ where: { status: "complete" }, select: { userId: true, assetId: true } }),
    db.profileField.findMany({ where: { key: "founder_type" }, select: { userId: true, valueJson: true } }),
    db.profileField.findMany({ where: { key: "freedom_number" }, select: { userId: true, valueJson: true } }),
    db.message.groupBy({ by: ["userId"], where: { role: "user", hidden: false, createdAt: { gte: since24h } }, _count: { _all: true } }),
    db.message.groupBy({ by: ["userId"], where: { role: "user", hidden: false, createdAt: { gte: since30d } }, _count: { _all: true } }),
  ]);
  const known = new Set(ASSETS.map((a) => a.id));
  const doneBy = new Map<string, Set<string>>();
  for (const d of done) if (known.has(d.assetId)) doneBy.set(d.userId, (doneBy.get(d.userId) ?? new Set()).add(d.assetId));
  const typeBy = new Map(types.map((t) => [t.userId, String(parseJson(t.valueJson, "") ?? "")]));
  const freedomBy = new Map(freedom.map((t) => [t.userId, Number(parseJson(t.valueJson, null)) || null]));
  const todayBy = new Map(today.map((m) => [m.userId, m._count._all]));
  const monthBy = new Map(month.map((m) => [m.userId, m._count._all]));
  return users.map((u) => {
    const ids = doneBy.get(u.id) ?? new Set<string>();
    return {
      id: u.id,
      name: [u.name, u.lastName].filter(Boolean).join(" "),
      email: u.email,
      role: u.role,
      disabled: u.disabled,
      test: isTestEmail(u.email),
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
      founderType: typeBy.get(u.id) ?? "",
      freedomNumber: freedomBy.get(u.id) ?? null,
      done: ids.size,
      doneIds: ids,
      messagesToday: todayBy.get(u.id) ?? 0,
      messagesMonth: monthBy.get(u.id) ?? 0,
    };
  });
}

// Real members: not test accounts and not the team.
export const realMembers = (rows: MemberRow[]) => rows.filter((r) => !r.test && r.role !== "admin");

export const when = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(d) : "Never";

export const day = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(d) : "";

export const TOTAL_TOOLS = ASSETS.length;

// Named slices of the member list, shared by the Overview widgets (each
// widget links to its slice) and the Members page filter.
export const FILTERS = {
  new: { label: "Joined in the last 7 days", test: (r: MemberRow) => r.createdAt.getTime() > Date.now() - 7 * DAY },
  active: { label: "Active in the last 7 days", test: (r: MemberRow) => !!r.lastSeenAt && r.lastSeenAt.getTime() > Date.now() - 7 * DAY },
  diagnosed: { label: "Finished the Diagnostic", test: (r: MemberRow) => !!r.founderType },
  nodiag: { label: "Haven't done the Diagnostic", test: (r: MemberRow) => !r.founderType },
  stuck: { label: "Joined 2+ days ago, no Diagnostic", test: (r: MemberRow) => !r.founderType && r.createdAt.getTime() < Date.now() - 2 * DAY },
  quiet: { label: "Gone quiet: not back in 14 days", test: (r: MemberRow) => !!r.founderType && (!r.lastSeenAt || r.lastSeenAt.getTime() < Date.now() - 14 * DAY) },
  today: { label: "Used the Assistant in the last 24 hours", test: (r: MemberRow) => r.messagesToday > 0 },
  off: { label: "Turned off", test: (r: MemberRow) => r.disabled },
} as const;
export type FilterKey = keyof typeof FILTERS;
