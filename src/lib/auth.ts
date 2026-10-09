// Email + password login with a server-side session table. The Command Center
// owns login for now; Skool SSO can replace createSession's caller later
// without touching anything that reads requireUser().

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { safeNext } from "./safeNext";

export { safeNext };

const COOKIE = "lf_session";
const DAYS = 30;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DAYS * 864e5);
  await db.session.create({ data: { id, userId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await db.session.deleteMany({ where: { id } });
  jar.delete(COOKIE);
}

export type CurrentUser = { id: string; email: string; name: string };

export async function getUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  const s = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return { id: s.user.id, email: s.user.email, name: s.user.name };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getUser();
  if (!u) {
    const here = safeNext((await headers()).get("x-pathname"));
    redirect(here && here !== "/dashboard" ? `/login?next=${encodeURIComponent(here)}` : "/login");
  }
  return u;
}
