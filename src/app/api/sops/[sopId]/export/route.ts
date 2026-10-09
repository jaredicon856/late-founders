import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db, parseJson } from "@/lib/db";
import type { DocBlock, RenderDoc } from "@/lib/docs/types";
import { renderDocx } from "@/lib/export/docx";
import { renderPdf } from "@/lib/export/pdf";
import { toContent } from "@/lib/sops";

export async function GET(req: Request, { params }: { params: Promise<{ sopId: string }> }) {
  const { sopId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const sop = await db.sop.findFirst({ where: { id: sopId, userId: user.id } });
  if (!sop) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const v = Number(url.searchParams.get("v")) || undefined;
  const ver = await db.sopVersion.findFirst({ where: { sopId, ...(v ? { version: v } : {}) }, orderBy: { version: "desc" } });
  if (!ver) return NextResponse.json({ error: "No such version" }, { status: 404 });
  const c = toContent(parseJson(ver.contentJson, {}));
  const blocks: DocBlock[] = [
    { type: "kv", items: [
      { label: "Role", value: sop.role },
      { label: "Owner", value: sop.owner || "Not set" },
      { label: "Next review", value: sop.nextReview ? sop.nextReview.toISOString().slice(0, 10) : "Not set" },
      { label: "Version", value: `${ver.version} · ${ver.createdAt.toISOString().slice(0, 10)}` },
    ] },
    ...(c.purpose ? [{ type: "paragraph" as const, text: c.purpose }] : []),
    { type: "heading", text: "Steps" },
    { type: "table", table: { headers: ["#", "What to do", "Why"], widths: [0.3, 3, 2], rows: c.steps.map((s, i) => [String(i + 1), s.what, s.why]) } },
    { type: "heading", text: "What to do if" },
    c.exceptions.length
      ? { type: "table", table: { headers: ["If", "Then"], widths: [1.6, 2.4], rows: c.exceptions.map((e) => [e.when, e.do]) } }
      : { type: "paragraph", text: "No exceptions recorded yet. Add them as they come up.", tone: "muted" },
    ...(c.notes ? [{ type: "heading" as const, text: "Notes" }, { type: "paragraph" as const, text: c.notes }] : []),
  ];
  const doc: RenderDoc = { title: sop.title, eyebrow: "COURSE 12 · GET OUT OF YOUR OWN BUSINESS · SOP LIBRARY", purpose: `Standard operating procedure for the ${sop.role} role.`, blocks };
  const docx = url.searchParams.get("format") === "docx";
  const bytes = docx ? await renderDocx(doc) : await renderPdf(doc);
  const name = `SOP - ${sop.title} v${ver.version}`.replace(/[^\w\s.-]/g, "");
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": docx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
      "content-disposition": `attachment; filename="${name}.${docx ? "docx" : "pdf"}"`,
    },
  });
}
