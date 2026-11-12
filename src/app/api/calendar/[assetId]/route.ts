import { NextResponse } from "next/server";
import { loadSheet } from "@/lib/assets";
import { campaignEvents, decisionEvents, toIcs } from "@/lib/calendar";
import { guardAsset } from "@/lib/guard";
import { getProfile } from "@/lib/record";
import { dayIn, memberTz } from "@/lib/tz";

export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const g = await guardAsset(assetId);
  if ("error" in g) return g.error;
  const today = dayIn(await memberTz());
  let events;
  if (assetId === "decision-engine") events = decisionEvents(await getProfile(g.user.id), today);
  else if (assetId === "campaign-metrics") events = campaignEvents((await loadSheet(g.user.id, assetId))?.data ?? {}, today);
  else return NextResponse.json({ error: "No calendar for this tool" }, { status: 404 });
  return new NextResponse(toIcs("Late Founders", events), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="late-founders-${assetId}.ics"`,
    },
  });
}
