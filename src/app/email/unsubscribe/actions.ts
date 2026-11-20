"use server";

import { db } from "@/lib/db";
import { validUnsubscribe } from "@/lib/notify";

export type UnsubState = { done?: "off" | "on"; error?: string };

export async function setUpdates(_: UnsubState, form: FormData): Promise<UnsubState> {
  const u = String(form.get("u") ?? "");
  const t = String(form.get("t") ?? "");
  const on = form.get("on") === "1";
  if (!validUnsubscribe(u, t)) return { error: "This link isn't valid. Use the link in your most recent email." };
  await db.user.update({ where: { id: u }, data: { emailUpdates: on } });
  return { done: on ? "on" : "off" };
}
