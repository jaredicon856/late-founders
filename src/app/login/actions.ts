"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSession, destroySession, getUser, hashPassword, safeNext, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendResetLink, sendWelcome } from "@/lib/mailers";
import { hashResetToken, resetUsable } from "@/lib/resetToken";

export type AuthState = { error?: string };

function clean(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v.trim() : "";
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = clean(form.get("email")).toLowerCase();
  const password = clean(form.get("password"));
  const user = email ? await db.user.findUnique({ where: { email } }) : null;
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email and password don't match." };
  }
  if (user.disabled) return { error: "This account has been turned off. Contact Late Founders if you think that's a mistake." };
  await createSession(user.id);
  redirect(safeNext(form.get("next")) ?? (user.role === "admin" ? "/admin" : "/dashboard"));
}

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const name = clean(form.get("name"));
  const lastName = clean(form.get("lastName"));
  const email = clean(form.get("email")).toLowerCase();
  const password = clean(form.get("password"));
  const code = clean(form.get("code"));
  const required = process.env.SIGNUP_CODE ?? "";
  if (required && code !== required) return { error: "That member code isn't right. You'll find it in the Skool classroom." };
  if (!name || !lastName) return { error: "Enter your first and last name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  if (password.length < 10) return { error: "Use at least 10 characters for your password." };
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with that email already exists. Log in instead." };
  const user = await db.user.create({ data: { name, lastName, email, passwordHash: await hashPassword(password) } });
  await createSession(user.id);
  await sendWelcome(email, name); // never blocks sign-up: a failed send is only logged
  redirect(safeNext(form.get("next")) ?? "/assets/founder-diagnostic");
}

// Accounts made before last names were asked for add theirs once.
export async function saveLastName(form: FormData) {
  const user = await getUser();
  const lastName = clean(form.get("lastName")).slice(0, 80);
  if (user && lastName) await db.user.update({ where: { id: user.id }, data: { lastName } });
  revalidatePath("/", "layout");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export type ForgotState = { done?: boolean; error?: string };

// Always answers the same way, so the form can't be used to find out who has an account.
export async function requestReset(_: ForgotState, form: FormData): Promise<ForgotState> {
  const email = clean(form.get("email")).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter the email you log in with." };
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (user) await sendResetLink(user.id, "forgot");
  return { done: true };
}

export type ResetFormState = { error?: string };

export async function completeReset(_: ResetFormState, form: FormData): Promise<ResetFormState> {
  const token = clean(form.get("token"));
  const password = clean(form.get("password"));
  if (password.length < 10) return { error: "Use at least 10 characters." };
  const r = token ? await db.passwordReset.findUnique({ where: { tokenHash: hashResetToken(token) } }) : null;
  if (!r || !resetUsable(r)) return { error: "This link has expired or was already used. Ask for a new one." };
  await db.$transaction([
    db.user.update({ where: { id: r.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.passwordReset.update({ where: { id: r.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: r.userId } }),
  ]);
  await createSession(r.userId);
  redirect("/dashboard");
}
