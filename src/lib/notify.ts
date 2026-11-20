// Portal emails beyond the account ones: announcements, the 14-day nudge and
// admin alerts. Every one of them carries an unsubscribe link; members who
// turned updates off (User.emailUpdates) never get them. Password and login
// emails (mailers.ts) are not affected by that setting.

import { createHmac, timingSafeEqual } from "node:crypto";
import { getStatuses, nextAsset } from "./assets";
import { db } from "./db";
import { isTestEmail, memberRows, realMembers } from "./admin";
import { layout, plain, sendBatch } from "./email";
import { getProfile } from "./record";
import { appUrl } from "./resetToken";

const DAY = 86_400_000;
const base = () => appUrl() ?? "https://portal.latefounders.com";

// --- unsubscribe links -------------------------------------------------------

function secret(): string {
  return process.env.CRON_SECRET || process.env.DATABASE_URL || "late-founders";
}

export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", secret()).update(`unsub:${userId}`).digest("base64url").slice(0, 32);
}

export function validUnsubscribe(userId: string, token: string): boolean {
  const a = Buffer.from(unsubscribeToken(userId));
  const b = Buffer.from(token || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(userId: string): string {
  return `${base()}/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
}

// For mail apps' own "Unsubscribe" button (RFC 8058): a POST to this address unsubscribes.
export function oneClickUrl(userId: string): string {
  return `${base()}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
}

type Person = { id: string; email: string; name: string };

function message(p: Person, subject: string, heading: string, paras: string[], button?: { label: string; url: string }) {
  const unsub = unsubscribeUrl(p.id);
  const footer = "You're getting this because you have a Late Founders Portal account. Unsubscribe from Portal updates:";
  return {
    to: p.email,
    subject,
    text: `${plain(heading, paras, button)}\n\n---\nUnsubscribe from Portal updates: ${unsub}`,
    html: layout(heading, paras, button, footer, unsub),
    headers: { "List-Unsubscribe": `<${oneClickUrl(p.id)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

// Members who should get updates: active, real, opted in.
async function recipients(opts: { admins?: boolean } = {}): Promise<Person[]> {
  const users = await db.user.findMany({
    where: { disabled: false, emailUpdates: true, ...(opts.admins ? { role: "admin" } : {}) },
    select: { id: true, email: true, name: true },
  });
  return users.filter((u) => !isTestEmail(u.email));
}

// --- 1. Announcements ----------------------------------------------------------

export async function emailAnnouncement(n: { title: string; body: string; link: string }): Promise<number> {
  const people = await recipients();
  const url = n.link ? (n.link.startsWith("/") ? base() + n.link : n.link) : `${base()}/notifications`;
  const paras = n.body ? n.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [];
  const sent = await sendBatch(people.map((p) => message(p, n.title, n.title, paras, { label: n.link ? "Open it" : "See it in the Portal", url })));
  return sent;
}

// --- 2. The 14-day nudge --------------------------------------------------------

// Members who have not opened the Portal for 14 days, and have not been nudged
// since they were last here, get one email naming their next tool. At most
// one nudge per quiet stretch, so never more than one a week.
export async function sendNudges(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 14 * DAY);
  const users = await db.user.findMany({
    where: { disabled: false, emailUpdates: true, role: "member" },
    select: { id: true, email: true, name: true, createdAt: true, lastSeenAt: true, lastNudgedAt: true },
  });
  const due = users.filter((u) => {
    if (isTestEmail(u.email)) return false;
    const seen = u.lastSeenAt ?? u.createdAt;
    if (seen > cutoff) return false;
    return !u.lastNudgedAt || u.lastNudgedAt < seen;
  });
  const messages = [];
  for (const u of due) {
    const [profile, statuses] = await Promise.all([getProfile(u.id), getStatuses(u.id)]);
    const next = nextAsset(profile, statuses);
    const paras = next
      ? [
          "It's been a couple of weeks since you were last in the Portal. Everything you saved is where you left it.",
          `Your next step on your route is the ${next.title}. Twenty minutes on it this week keeps the momentum going.`,
        ]
      : ["It's been a couple of weeks since you were last in the Portal. You've finished every tool on your route, so this is a good time to revisit your numbers and update anything that changed."];
    messages.push(
      message(u, next ? `Next up: ${next.title}` : "Time to revisit your numbers", `Pick up where you left off, ${u.name}`, paras, {
        label: next ? `Open the ${next.title}` : "Open my dashboard",
        url: next ? `${base()}/assets/${next.id}` : `${base()}/dashboard`,
      }),
    );
  }
  const sent = await sendBatch(messages);
  if (due.length) await db.user.updateMany({ where: { id: { in: due.map((u) => u.id) } }, data: { lastNudgedAt: now } });
  return sent;
}

// --- 3. Admin alerts ------------------------------------------------------------

export async function alertNewMember(m: { name: string; lastName: string; email: string }) {
  const admins = await recipients({ admins: true });
  if (!admins.length) return;
  const who = [m.name, m.lastName].filter(Boolean).join(" ");
  await sendBatch(
    admins.map((a) =>
      message(a, `New member: ${who}`, `${who} just joined the Portal`, [`Email: ${m.email}`, "They start with the Founder Diagnostic. You'll see their progress on the Members page."], {
        label: "Open Members",
        url: `${base()}/admin/members`,
      }),
    ),
  );
}

// Monday summary for admins: who joined, who's active, who needs a nudge.
export async function sendWeeklySummary(now = new Date()): Promise<number> {
  const admins = await recipients({ admins: true });
  if (!admins.length) return 0;
  const rows = realMembers(await memberRows()).filter((r) => !r.disabled);
  const week = now.getTime() - 7 * DAY;
  const joined = rows.filter((r) => r.createdAt.getTime() >= week);
  const active = rows.filter((r) => r.lastSeenAt && r.lastSeenAt.getTime() >= week);
  const stuck = rows.filter((r) => !r.founderType && r.createdAt.getTime() < now.getTime() - 2 * DAY);
  const quiet = rows.filter((r) => r.founderType && (!r.lastSeenAt || r.lastSeenAt.getTime() < now.getTime() - 14 * DAY));
  const list = (xs: typeof rows) => (xs.length ? xs.slice(0, 10).map((r) => r.name || r.email).join(", ") + (xs.length > 10 ? ` and ${xs.length - 10} more` : "") : "none");
  const paras = [
    `${rows.length} members in total. ${active.length} used the Portal this week.`,
    `New this week (${joined.length}): ${list(joined)}.`,
    `Joined but haven't done the Diagnostic (${stuck.length}): ${list(stuck)}.`,
    `Gone quiet for 14+ days (${quiet.length}): ${list(quiet)}. They get an automatic reminder.`,
  ];
  return sendBatch(admins.map((a) => message(a, "Late Founders Portal: your week", "Your week in the Portal", paras, { label: "Open the admin overview", url: `${base()}/admin` })));
}
