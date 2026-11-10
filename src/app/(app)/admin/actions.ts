"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isTestEmail } from "@/lib/admin";
import { hashPassword, requireAdmin, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export type ResetState = { password?: string; error?: string };
export type TeamState = { ok?: string; error?: string };

// A new random password, shown once to the admin to pass on privately.
// Logs the member out everywhere.
export async function resetPassword(_: ResetState, form: FormData): Promise<ResetState> {
  await requireAdmin();
  const userId = str(form.get("userId"));
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return { error: "No such member." };
  const password = randomBytes(9).toString("base64url");
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId } });
  return { password };
}

// Turning an account off logs them out and stops them logging back in. Their work is kept.
export async function setDisabled(form: FormData) {
  const me = await requireAdmin();
  const userId = str(form.get("userId"));
  const disabled = str(form.get("disabled")) === "1";
  if (userId === me.id) return;
  await db.user.update({ where: { id: userId }, data: { disabled } });
  if (disabled) await db.session.deleteMany({ where: { userId } });
  revalidatePath("/admin", "layout");
}

// Admins are only ever added here, by another admin, and only to an account
// that already exists: sign-up does not prove someone owns their email.
export async function setAdmin(_: TeamState, form: FormData): Promise<TeamState> {
  const me = await requireAdmin();
  const email = str(form.get("email")).toLowerCase();
  const make = str(form.get("make")) === "1";
  if (!email) return { error: "Enter an email." };
  if (!make && email === me.email) return { error: "You can't remove yourself." };
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) return { error: `No account uses ${email}. They need to sign up with the member code first, then you can make them an admin.` };
  await db.user.update({ where: { id: user.id }, data: { role: make ? "admin" : "member" } });
  revalidatePath("/admin", "layout");
  return { ok: make ? `${user.name} is now an admin.` : `${user.name} is no longer an admin.` };
}

// An admin changing their own password (the first admin's starts as a shared one).
export async function changeOwnPassword(_: TeamState, form: FormData): Promise<TeamState> {
  const me = await requireAdmin();
  const current = str(form.get("current"));
  const next = str(form.get("next"));
  const user = await db.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: "Your current password isn't right." };
  if (next.length < 10) return { error: "Use at least 10 characters." };
  if (next === current) return { error: "Choose a different password." };
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: "Password changed." };
}

// Deletes accounts on test email domains (e.g. qa+…@example.com) and all their work.
export async function removeTestAccounts(_: TeamState): Promise<TeamState> {
  const me = await requireAdmin();
  const all = await db.user.findMany({ select: { id: true, email: true } });
  const ids = all.filter((u) => isTestEmail(u.email) && u.id !== me.id).map((u) => u.id);
  if (!ids.length) return { ok: "There are no test accounts." };
  const { count } = await db.user.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/admin", "layout");
  return { ok: `Removed ${count} test ${count === 1 ? "account" : "accounts"}.` };
}
