"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, hashPassword, safeNext, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

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
  await createSession(user.id);
  redirect(safeNext(form.get("next")) ?? "/dashboard");
}

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const name = clean(form.get("name"));
  const email = clean(form.get("email")).toLowerCase();
  const password = clean(form.get("password"));
  const code = clean(form.get("code"));
  const required = process.env.SIGNUP_CODE ?? "";
  if (required && code !== required) return { error: "That member code isn't right. You'll find it in the Skool classroom." };
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter your name and a valid email." };
  if (password.length < 10) return { error: "Use at least 10 characters for your password." };
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with that email already exists. Log in instead." };
  const user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await createSession(user.id);
  redirect(safeNext(form.get("next")) ?? "/assets/founder-diagnostic");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
