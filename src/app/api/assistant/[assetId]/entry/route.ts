import { NextResponse } from "next/server";
import { getMode } from "@/content/registry";
import { guardAsset } from "@/lib/guard";
import { writeProfile } from "@/lib/record";

// Member-typed values (e.g. smoke-test numbers) for an AI app's record field.
export async function POST(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const g = await guardAsset(assetId);
  if ("error" in g) return g.error;
  const entry = getMode(assetId)?.memberEntry;
  if (!entry) return NextResponse.json({ error: "Nothing to enter here" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { values?: Record<string, unknown> } | null;
  const values: Record<string, unknown> = {};
  for (const f of entry.fields) {
    const v = body?.values?.[f.key];
    if (v === null || v === undefined || v === "") values[f.key] = null;
    else if (["number", "money", "percent"].includes(f.type)) {
      const n = Number(v);
      if (!Number.isFinite(n)) return NextResponse.json({ error: `${f.label} must be a number` }, { status: 400 });
      values[f.key] = n;
    } else values[f.key] = String(v).slice(0, 2000);
  }
  await writeProfile(g.user.id, { [entry.key]: values }, "member");
  return NextResponse.json({ ok: true });
}
