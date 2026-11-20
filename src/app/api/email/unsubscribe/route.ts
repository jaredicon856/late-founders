import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validUnsubscribe } from "@/lib/notify";

// One-click unsubscribe from a mail app's own button (POST), or a plain visit (GET → the page).
export async function POST(req: Request) {
  const url = new URL(req.url);
  const u = url.searchParams.get("u") ?? "";
  const t = url.searchParams.get("t") ?? "";
  if (!validUnsubscribe(u, t)) return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  await db.user.update({ where: { id: u }, data: { emailUpdates: false } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL(`/email/unsubscribe${url.search}`, url));
}
