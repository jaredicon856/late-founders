import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getProfile, writeProfile } from "@/lib/record";

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { done?: unknown } | null;
  const profile = await getProfile(user.id, ["first_five_moves"]);
  const n = Array.isArray(profile.first_five_moves) ? profile.first_five_moves.length : 0;
  if (!Array.isArray(body?.done) || body.done.length !== n) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await writeProfile(user.id, { first_five_done: body.done.map(Boolean) }, "member");
  return NextResponse.json({ ok: true });
}
