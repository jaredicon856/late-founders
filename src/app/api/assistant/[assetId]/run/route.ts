import { NextResponse } from "next/server";
import { getMode } from "@/content/registry";
import { getTranscript, startNewRun } from "@/lib/assistant/engine";
import { guardAsset } from "@/lib/guard";

export async function POST(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const g = await guardAsset(assetId);
  if ("error" in g) return g.error;
  if (!getMode(assetId)) return NextResponse.json({ error: "Not an AI app" }, { status: 404 });
  const run = await startNewRun(g.user.id, assetId);
  return NextResponse.json({ run, messages: await getTranscript(g.user.id, assetId, run) });
}
