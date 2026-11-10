import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { exportAsset } from "@/lib/export/respond";

export async function GET(req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return exportAsset(user, assetId, new URL(req.url));
}
