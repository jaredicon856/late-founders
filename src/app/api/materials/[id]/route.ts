import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Serves a team-uploaded file to signed-in members. Opens in the browser
// (PDFs, images); ?download=1 saves it instead. Unpublished files: team only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(new URL(req.url).pathname)}`, req.url));
  const { id } = await params;
  const m = await db.material.findUnique({ where: { id }, select: { kind: true, data: true, fileName: true, mimeType: true, published: true } });
  if (!m || m.kind !== "file" || !m.data || (!m.published && !user.isAdmin)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Only PDFs and plain images open in the browser; anything else downloads,
  // so an uploaded file can never run as a page on this site.
  const viewable = /^(application\/pdf|image\/(png|jpeg|gif|webp))$/.test(m.mimeType);
  const download = !viewable || new URL(req.url).searchParams.get("download") === "1";
  const safe = m.fileName.replace(/[^\w\s.()-]/g, "_");
  return new NextResponse(Buffer.from(m.data), {
    headers: {
      "content-type": m.mimeType || "application/octet-stream",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${safe}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
