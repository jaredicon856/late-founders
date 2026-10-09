import { NextResponse } from "next/server";
import { getAsset } from "@/content/catalog";
import { getWorksheet } from "@/content/registry";
import { loadSheet } from "@/lib/assets";
import { getUser } from "@/lib/auth";
import { db, parseJson } from "@/lib/db";
import type { RenderDoc } from "@/lib/docs/types";
import { worksheetToDoc } from "@/lib/docs/fromWorksheet";
import { renderDataRoomZip } from "@/lib/export/dataRoomZip";
import { renderDocx } from "@/lib/export/docx";
import { renderPdf } from "@/lib/export/pdf";
import { renderXlsx } from "@/lib/export/xlsx";

const TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
} as const;
type Format = keyof typeof TYPES;

function fileName(title: string, version: number | null, ext: string) {
  const base = `Late Founders - ${title}${version ? ` v${version}` : ""}`.replace(/[^\w\s.-]/g, "").trim();
  return `${base}.${ext}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const asset = getAsset(assetId);
  if (!asset) return NextResponse.json({ error: "Unknown asset" }, { status: 404 });

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "pdf") as Format;
  if (!(format in TYPES)) return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  const vParam = url.searchParams.get("v");

  let doc: RenderDoc;
  let version: number | null = null;
  let completedAt: Date | null = null;

  if (vParam) {
    const v = await db.assetVersion.findUnique({ where: { userId_assetId_version: { userId: user.id, assetId, version: Number(vParam) } } });
    if (!v) return NextResponse.json({ error: "No such version" }, { status: 404 });
    doc = parseJson<RenderDoc>(v.docJson, { title: asset.title, eyebrow: "", purpose: "", blocks: [] });
    version = v.version;
    completedAt = v.createdAt;
  } else if (getWorksheet(assetId)) {
    // Current working state, including blank sheets for printing.
    const sheet = await loadSheet(user.id, assetId);
    if (!sheet) return NextResponse.json({ error: "Unknown worksheet" }, { status: 404 });
    doc = worksheetToDoc(asset, sheet.def, sheet.data, sheet.profile);
  } else {
    const v = await db.assetVersion.findFirst({ where: { userId: user.id, assetId }, orderBy: { version: "desc" } });
    if (!v) return NextResponse.json({ error: "Nothing saved yet" }, { status: 404 });
    doc = parseJson<RenderDoc>(v.docJson, { title: asset.title, eyebrow: "", purpose: "", blocks: [] });
    version = v.version;
    completedAt = v.createdAt;
  }

  doc = {
    ...doc,
    meta: {
      member: doc.template === "neutral" ? undefined : user.name,
      completedAt: completedAt?.toLocaleDateString("en-US", { dateStyle: "medium" }),
      version: version ?? undefined,
    },
  };

  const bytes =
    format === "zip"
      ? assetId === "data-room"
        ? await renderDataRoomZip(doc)
        : null
      : format === "docx"
        ? await renderDocx(doc)
        : format === "xlsx"
          ? await renderXlsx(doc)
          : await renderPdf(doc);
  if (!bytes) return NextResponse.json({ error: "Not available as a zip" }, { status: 400 });

  const title = assetId === "data-room" && format === "zip" ? "Data Room" : doc.template === "neutral" ? doc.title : asset.title;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": TYPES[format],
      "content-disposition": `attachment; filename="${fileName(title, version, format)}"`,
      "cache-control": "private, no-store",
    },
  });
}
