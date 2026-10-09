import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardAsset } from "@/lib/guard";
import { getProfile, writeProfile } from "@/lib/record";
import { listSops, toContent } from "@/lib/sops";

const clip = (v: unknown, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);

// action: "add_role" | "save" (create or update; every change is a new version) | "move"
export async function POST(req: Request) {
  const g = await guardAsset("sop-library");
  if ("error" in g) return g.error;
  const userId = g.user.id;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "add_role") {
    const role = clip(body.role, 60);
    if (!role) return NextResponse.json({ error: "Name the role folder." }, { status: 400 });
    const p = await getProfile(userId, ["sop_roles"]);
    const roles = Array.isArray(p.sop_roles) ? (p.sop_roles as string[]) : [];
    if (!roles.some((r) => r.toLowerCase() === role.toLowerCase())) await writeProfile(userId, { sop_roles: [...roles, role] }, "sop-library");
  } else if (body.action === "save") {
    const title = clip(body.title, 120);
    const role = clip(body.role, 60);
    if (!title || !role) return NextResponse.json({ error: "An SOP needs a task-based title and a role." }, { status: 400 });
    const content = JSON.stringify(toContent(body.content));
    const notes = clip(body.notes, 500) || "Edited";
    const data = { title, role, owner: clip(body.owner, 80), nextReview: date(body.nextReview) };
    if (typeof body.id === "string") {
      const sop = await db.sop.findFirst({ where: { id: body.id, userId } });
      if (!sop) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const last = await db.sopVersion.findFirst({ where: { sopId: sop.id }, orderBy: { version: "desc" } });
      await db.$transaction([
        db.sop.update({ where: { id: sop.id }, data }),
        db.sopVersion.create({ data: { sopId: sop.id, version: (last?.version ?? 0) + 1, contentJson: content, notes } }),
      ]);
    } else {
      await db.sop.create({ data: { ...data, userId, versions: { create: { version: 1, contentJson: content, notes: "Created by hand" } } } });
    }
    await db.assetState.upsert({
      where: { userId_assetId: { userId, assetId: "sop-library" } },
      create: { userId, assetId: "sop-library", status: "complete", completedAt: new Date() },
      update: { status: "complete", completedAt: new Date() },
    });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const p = await getProfile(userId, ["sop_roles"]);
  return NextResponse.json({ sops: await listSops(userId), roles: Array.isArray(p.sop_roles) ? p.sop_roles : [] });
}
