import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

// Browser crashes are reported here so they show up in the Vercel runtime logs.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = await getUser().catch(() => null);
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  console.error(
    "CLIENT_ERROR",
    JSON.stringify({
      user: user?.id ?? null,
      path: s(body.path, 200),
      message: s(body.message, 500),
      digest: s(body.digest, 100),
      stack: s(body.stack, 2000),
      agent: s(req.headers.get("user-agent"), 200),
    }),
  );
  return NextResponse.json({ ok: true });
}
