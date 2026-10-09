// Work a save triggers beyond the member record: generated documents that
// depend on it, and records that live in their own tables.

import { getAsset } from "@/content/catalog";
import { getWorksheet } from "@/content/registry";
import type { RenderDoc } from "@/lib/docs/types";
import { worksheetToDoc } from "@/lib/docs/fromWorksheet";
import { createVersion, setStatus } from "@/lib/assets";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/record";

function str(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

export async function afterSave(userId: string, assetId: string, output: Record<string, unknown>, doc: RenderDoc) {
  if (assetId === "founder-diagnostic") {
    // The Personal Roadmap is generated from the diagnostic; refresh it.
    const asset = getAsset("personal-roadmap");
    const def = getWorksheet("personal-roadmap");
    if (asset && def) {
      const profile = await getProfile(userId);
      const data = def.live?.(profile) ?? {};
      await createVersion(userId, asset.id, data, worksheetToDoc(asset, def, data, profile), "Generated from your diagnostic");
      await setStatus(userId, asset.id, "complete");
    }
  }

  if (assetId === "sop-generator") {
    const title = str(output.title) || "Untitled SOP";
    const role = str(output.role) || "Unassigned";
    const next = str(output.next_review);
    const nextReview = /^\d{4}-\d{2}-\d{2}$/.test(next) ? new Date(`${next}T00:00:00Z`) : null;
    const content = JSON.stringify({
      purpose: output.purpose ?? "",
      steps: output.steps ?? [],
      exceptions: output.exceptions ?? [],
      notes: output.notes ?? "",
      doc,
    });
    // Same title in the same role is a new version of that SOP, not a duplicate.
    const existing = await db.sop.findFirst({ where: { userId, role, title } });
    if (existing) {
      const last = await db.sopVersion.findFirst({ where: { sopId: existing.id }, orderBy: { version: "desc" } });
      await db.sopVersion.create({ data: { sopId: existing.id, version: (last?.version ?? 0) + 1, contentJson: content, notes: "Regenerated" } });
      await db.sop.update({ where: { id: existing.id }, data: { owner: str(output.owner), nextReview } });
    } else {
      await db.sop.create({
        data: {
          userId, role, title, owner: str(output.owner), nextReview,
          versions: { create: { version: 1, contentJson: content, notes: "Created by the SOP Generator" } },
        },
      });
    }
    await setStatus(userId, "sop-library", "in_progress");
  }
}
