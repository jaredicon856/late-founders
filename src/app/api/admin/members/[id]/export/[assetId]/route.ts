import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { exportAsset } from "@/lib/export/respond";

// An admin downloading one member's file, exactly as the member would get it.
export async function GET(req: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const me = await getUser();
  if (!me?.isAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { id, assetId } = await params;
  const member = await db.user.findUnique({ where: { id }, select: { id: true, name: true, lastName: true } });
  if (!member) return NextResponse.json({ error: "No such member" }, { status: 404 });
  return exportAsset({ id: member.id, fullName: [member.name, member.lastName].filter(Boolean).join(" ") }, assetId, new URL(req.url));
}
