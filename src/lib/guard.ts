import { NextResponse } from "next/server";
import { getAsset } from "@/content/catalog";
import { getUser, type CurrentUser } from "./auth";

// Shared checks for asset API routes: signed in, and the asset exists.
export async function guardAsset(assetId: string): Promise<{ user: CurrentUser } | { error: NextResponse }> {
  const user = await getUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  if (!getAsset(assetId)) return { error: NextResponse.json({ error: "Unknown asset" }, { status: 404 }) };
  return { user };
}
