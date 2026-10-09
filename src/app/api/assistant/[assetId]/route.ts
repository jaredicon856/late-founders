import { NextResponse } from "next/server";
import { getMode } from "@/content/registry";
import { runTurn } from "@/lib/assistant/engine";
import { guardAsset } from "@/lib/guard";

export const maxDuration = 300; // long Assistant turns (thinking + a save round-trip)

export async function POST(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const g = await guardAsset(assetId);
  if ("error" in g) return g.error;
  if (!getMode(assetId)) return NextResponse.json({ error: "Not an AI app" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message : "";
  if (!message.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  if (message.length > 50_000) return NextResponse.json({ error: "That message is too long. Split it up." }, { status: 413 });
  return NextResponse.json(await runTurn(g.user.id, assetId, message));
}
