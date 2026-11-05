import { NextResponse } from "next/server";
import { getAsset } from "@/content/catalog";
import { getWorksheet } from "@/content/registry";
import { saveSheet } from "@/lib/assets";
import { getUser } from "@/lib/auth";
import { getProfile } from "@/lib/record";

const MAX_BYTES = 1_000_000;

export async function POST(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const def = getWorksheet(assetId);
  if (!getAsset(assetId) || !def) return NextResponse.json({ error: "Unknown worksheet" }, { status: 404 });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: { data?: unknown; complete?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const data = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? (body.data as Record<string, unknown>) : {};

  if (body.complete === true && def.completeCheck) {
    const problem = def.completeCheck(data, await getProfile(user.id));
    if (problem) return NextResponse.json({ error: problem }, { status: 422 });
  }
  const result = await saveSheet(user.id, assetId, data, body.complete === true);
  return NextResponse.json(result);
}
