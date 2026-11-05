import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getProfile, writeProfile } from "@/lib/record";

const DAY = 24 * 60 * 60 * 1000;
const KEEP = 400; // about a year of check-ins

// Checks the member's daily founder action on or off for one day (their local date).
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { date?: unknown; done?: unknown } | null;
  const date = typeof body?.date === "string" ? body.date : "";
  const t = Date.parse(`${date}T12:00:00Z`);
  // Allow any time zone's "today": within a day and a half of the server's clock.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(t) || Math.abs(t - Date.now()) > 1.5 * DAY) {
    return NextResponse.json({ error: "Bad date" }, { status: 400 });
  }
  const profile = await getProfile(user.id, ["daily_action_log"]);
  const log = new Set(Array.isArray(profile.daily_action_log) ? (profile.daily_action_log as string[]) : []);
  if (body?.done === true) log.add(date);
  else log.delete(date);
  await writeProfile(user.id, { daily_action_log: [...log].sort().slice(-KEEP) }, "member");
  return NextResponse.json({ ok: true });
}
