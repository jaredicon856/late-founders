import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Daily Vercel Cron call (vercel.json). One trivial query counts as database
// activity, so a Free-plan Supabase project is never paused for inactivity
// during quiet weeks. Vercel sends "Authorization: Bearer $CRON_SECRET".
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await db.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
