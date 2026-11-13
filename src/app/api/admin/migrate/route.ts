import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { runMigration } from "@/lib/migrate";

export const maxDuration = 300;

// POST { mode: "check" | "copy" }. Admins only, and only while
// MIGRATE_TO_DIRECT_URL is set in the environment.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode === "copy" ? "copy" : "check";
  try {
    return NextResponse.json(await runMigration(mode));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 500) : "Migration failed" }, { status: 500 });
  }
}
