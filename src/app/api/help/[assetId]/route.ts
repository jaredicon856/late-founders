import { NextResponse } from "next/server";
import { getWorksheet } from "@/content/registry";
import { aiConfigured } from "@/lib/assistant/engine";
import { askHelp, helpTranscript } from "@/lib/assistant/help";
import { overDailyLimit } from "@/lib/assistant/limit";
import { guardAsset } from "@/lib/guard";

export const maxDuration = 120;

export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const g = await guardAsset(assetId);
  if ("error" in g) return g.error;
  if (!getWorksheet(assetId)) return NextResponse.json({ error: "Not a worksheet" }, { status: 404 });
  return NextResponse.json({ messages: await helpTranscript(g.user.id, assetId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const g = await guardAsset(assetId);
  if ("error" in g) return g.error;
  if (!getWorksheet(assetId)) return NextResponse.json({ error: "Not a worksheet" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  if (message.length > 5_000) return NextResponse.json({ error: "That question is too long. Shorten it." }, { status: 413 });
  if (!aiConfigured()) return NextResponse.json({ error: "The Assistant isn't connected yet." }, { status: 503 });
  const capped = await overDailyLimit(g.user.id);
  if (capped) return NextResponse.json({ error: capped }, { status: 429 });
  return NextResponse.json(await askHelp(g.user.id, assetId, message));
}
