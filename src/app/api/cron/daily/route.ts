import { NextResponse } from "next/server";
import { emailConfigured } from "@/lib/email";
import { sendNudges, sendWeeklySummary } from "@/lib/notify";

// Daily Vercel Cron (vercel.json): the 14-day nudges every day, and the admin
// summary on Mondays. Vercel sends "Authorization: Bearer $CRON_SECRET".
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!emailConfigured()) return NextResponse.json({ ok: true, skipped: "email not configured" });
  const now = new Date();
  const nudges = await sendNudges(now);
  const summary = now.getUTCDay() === 1 ? await sendWeeklySummary(now) : 0;
  return NextResponse.json({ ok: true, nudges, summary });
}
