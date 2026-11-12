import { dayLabel, memberTz } from "@/lib/tz";
import { NextResponse } from "next/server";
import { getAsset } from "@/content/catalog";
import { getWorksheet } from "@/content/registry";
import { loadSheet } from "@/lib/assets";
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

// Builds a download (PDF, DOCX, XLSX or zip) of one member's asset: a saved
// version when ?v= is given, else the live worksheet or latest saved output.
// Used by the member's own downloads and by admins viewing a member.
export async function exportAsset(owner: { id: string; fullName: string }, assetId: string, url: URL): Promise<NextResponse> {
  const asset = getAsset(assetId);
  if (!asset) return NextResponse.json({ error: "Unknown asset" }, { status: 404 });

  const format = (url.searchParams.get("format") ?? "pdf") as Format;
  if (!(format in TYPES)) return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  const vParam = url.searchParams.get("v");

  let doc: RenderDoc;
  let version: number | null = null;
  let completedAt: Date | null = null;

  if (vParam) {
    const v = await db.assetVersion.findUnique({ where: { userId_assetId_version: { userId: owner.id, assetId, version: Number(vParam) } } });
    if (!v) return NextResponse.json({ error: "No such version" }, { status: 404 });
    doc = parseJson<RenderDoc>(v.docJson, { title: asset.title, eyebrow: "", purpose: "", blocks: [] });
    version = v.version;
    completedAt = v.createdAt;
  } else if (getWorksheet(assetId)) {
    // Current working state, including blank sheets for printing.
    const sheet = await loadSheet(owner.id, assetId);
    if (!sheet) return NextResponse.json({ error: "Unknown worksheet" }, { status: 404 });
    doc = worksheetToDoc(asset, sheet.def, sheet.data, sheet.profile);
  } else {
    const v = await db.assetVersion.findFirst({ where: { userId: owner.id, assetId }, orderBy: { version: "desc" } });
    if (!v) return NextResponse.json({ error: "Nothing saved yet" }, { status: 404 });
    doc = parseJson<RenderDoc>(v.docJson, { title: asset.title, eyebrow: "", purpose: "", blocks: [] });
    version = v.version;
    completedAt = v.createdAt;
  }

  doc = {
    ...doc,
    meta: {
      member: doc.template === "neutral" ? undefined : owner.fullName,
      completedAt: completedAt ? dayLabel(completedAt, await memberTz()) : undefined,
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
      // ?inline=1 opens a PDF in the browser instead of saving it.
      "content-disposition": `${format === "pdf" && url.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="${fileName(title, version, format)}"`,
      "cache-control": "private, no-store",
    },
  });
}
