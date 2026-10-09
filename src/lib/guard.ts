import { NextResponse } from "next/server";
import { getAsset } from "@/content/catalog";
import { getStatuses, isUnlocked } from "./assets";
import { getUser, type CurrentUser } from "./auth";
import { getProfile } from "./record";

// Shared checks for asset API routes: signed in, asset exists, course open.
export async function guardAsset(assetId: string): Promise<{ user: CurrentUser } | { error: NextResponse }> {
  const user = await getUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  if (!getAsset(assetId)) return { error: NextResponse.json({ error: "Unknown asset" }, { status: 404 }) };
  const [profile, statuses] = await Promise.all([getProfile(user.id), getStatuses(user.id)]);
  if (!isUnlocked(assetId, profile, statuses)) return { error: NextResponse.json({ error: "Locked" }, { status: 403 }) };
  return { user };
}
