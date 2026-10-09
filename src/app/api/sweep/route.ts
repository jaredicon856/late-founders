import { NextResponse } from "next/server";
import { getAsset, eyebrowFor } from "@/content/catalog";
import { createVersion, setStatus } from "@/lib/assets";
import type { DocBlock, RenderDoc } from "@/lib/docs/types";
import { guardAsset } from "@/lib/guard";
import { writeProfile } from "@/lib/record";
import { sweepName, type NameSweep } from "@/lib/sweep";

export const maxDuration = 60;

const MARK = { available: "Free", taken: "Taken", unknown: "Couldn't check", not_run: "Check by hand" } as const;

function toDoc(results: NameSweep[], category: string): RenderDoc {
  const asset = getAsset("availability-sweep")!;
  const blocks: DocBlock[] = [
    { type: "kv", items: [{ label: "Business category", value: category }, { label: "Checked", value: new Date().toLocaleDateString("en-US", { dateStyle: "medium" }) }] },
    {
      type: "table",
      table: {
        headers: ["Name", ".com", "Best free domain", "Handles free", "Trademark"],
        widths: [1.2, 0.8, 1.6, 1.2, 1.6],
        rows: results.map((r) => [
          r.name,
          MARK[r.domains[0]?.status ?? "unknown"],
          r.domains.find((d) => d.status === "available")?.domain ?? "None found",
          `${r.handles.filter((h) => h.status === "available").length} of ${r.handles.filter((h) => h.status !== "not_run").length} checked`,
          r.trademark.status === "done" ? `${r.trademark.hits.length} hits` : r.trademark.status === "not_run" ? "Not searched" : "Search failed",
        ]),
      },
    },
  ];
  for (const r of results) {
    blocks.push({ type: "heading", text: r.name });
    if (r.domainFlag) blocks.push({ type: "callout", tone: "warning", text: r.domainFlag });
    blocks.push({ type: "table", table: { headers: ["Domain", "Status"], widths: [2, 1], rows: r.domains.map((d) => [d.domain, MARK[d.status]]) } });
    blocks.push({ type: "table", table: { headers: ["Platform", "Handle", "Status"], widths: [1, 1.4, 1.4], rows: r.handles.map((h) => [h.platform, `@${h.handle}`, MARK[h.status]]) } });
    if (r.trademark.hits.length) {
      blocks.push({
        type: "table",
        table: {
          headers: ["Mark", "Owner", "Classes", "Status", "Similarity"],
          widths: [1.2, 1.4, 1, 0.8, 0.7],
          rows: r.trademark.hits.map((h) => [h.mark, h.owner, h.classes, h.status, `${h.similarity}%`]),
        },
      });
    }
    blocks.push({ type: "paragraph", text: r.trademark.message, tone: r.trademark.status === "done" ? undefined : "accent" });
  }
  blocks.push({
    type: "callout",
    tone: "legal",
    title: "These are raw results, not a legal clearance",
    text: "Similarity scores and categories help you triage with the Trademark Conflict Triage Guide. Whether a mark conflicts is a legal judgment. See a trademark attorney before you commit to a name with close hits in your category.",
  });
  return { title: asset.title, eyebrow: eyebrowFor(asset), purpose: asset.summary, blocks };
}

export async function POST(req: Request) {
  const g = await guardAsset("availability-sweep");
  if ("error" in g) return g.error;
  const body = (await req.json().catch(() => null)) as { names?: unknown; category?: unknown } | null;
  const names = (Array.isArray(body?.names) ? body.names : [])
    .map((n) => (typeof n === "string" ? n.trim().slice(0, 60) : ""))
    .filter(Boolean)
    .slice(0, 5);
  const category = typeof body?.category === "string" ? body.category.trim().slice(0, 120) : "";
  if (!names.length) return NextResponse.json({ error: "Enter at least one name." }, { status: 400 });
  if (!category) return NextResponse.json({ error: "Enter your business category." }, { status: 400 });

  const results = await Promise.all(names.map((n) => sweepName(n, category)));
  const doc = toDoc(results, category);
  await writeProfile(g.user.id, { sweep_results: { date: new Date().toISOString().slice(0, 10), category, results } }, "availability-sweep");
  const version = await createVersion(g.user.id, "availability-sweep", { names, category, results }, doc, names.join(", "));
  await setStatus(g.user.id, "availability-sweep", "complete");
  return NextResponse.json({ results, version });
}
