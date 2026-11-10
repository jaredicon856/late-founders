// The notification bell: announcements from the team to every member. A
// member sees notices from the day their account was made; opening the
// Notifications page marks them all read.

import { db } from "./db";

export async function addNotice(n: { title: string; body?: string; link?: string }) {
  await db.notice.create({ data: { title: n.title.slice(0, 200), body: (n.body ?? "").slice(0, 2000), link: n.link ?? "" } });
}

export async function unreadCount(userId: string): Promise<number> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true, noticesSeenAt: true } });
  if (!u) return 0;
  const since = u.noticesSeenAt && u.noticesSeenAt > u.createdAt ? u.noticesSeenAt : u.createdAt;
  return db.notice.count({ where: { createdAt: { gt: since } } });
}

export async function readNotices(userId: string, limit = 50) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true, noticesSeenAt: true } });
  if (!u) return { notices: [], seenAt: null as Date | null };
  const notices = await db.notice.findMany({ where: { createdAt: { gte: u.createdAt } }, orderBy: { createdAt: "desc" }, take: limit });
  await db.user.update({ where: { id: userId }, data: { noticesSeenAt: new Date() } });
  return { notices, seenAt: u.noticesSeenAt };
}
