// Team-added course materials and resources (see the Material and Course
// models). Lists never load file bytes; only /api/materials/[id] does.

import { COURSES, courseLabel } from "@/content/catalog";
import { db } from "./db";

export const MAX_FILE = 4 * 1024 * 1024; // what a Vercel function accepts in one request

export const builtInKey = (n: number) => `c${n}`;

export const MATERIAL_SELECT = {
  id: true, courseKey: true, place: true, title: true, description: true, kind: true, url: true, body: true,
  fileName: true, mimeType: true, sizeBytes: true, published: true, createdAt: true,
} as const;

export type MaterialRow = Awaited<ReturnType<typeof listMaterials>>[number];

export async function listMaterials(where: { courseKey?: string | { in: string[] }; published?: boolean } = {}) {
  return db.material.findMany({ where, orderBy: { createdAt: "asc" }, select: MATERIAL_SELECT });
}

// A course key's display name, for built-in and team-built courses alike.
export async function courseName(key: string): Promise<string | null> {
  if (key === "") return "Resources";
  const m = /^c(\d+)$/.exec(key);
  if (m) {
    const c = COURSES.find((x) => x.number === Number(m[1]));
    return c ? `${courseLabel(c.number)} · ${c.title}` : null;
  }
  const c = await db.course.findUnique({ where: { id: key }, select: { title: true } });
  return c?.title ?? null;
}

export const sizeText = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Where a member opens a material: files through our route (opens in the
// browser), links straight to their address. Notes have no link.
export const materialHref = (m: { id: string; kind: string; url: string }) =>
  m.kind === "file" ? `/api/materials/${m.id}` : m.kind === "link" ? m.url : "";

// A course as members see it: its built-in tools with the team's items placed
// at the top, right after a chosen tool, or at the end.
export type CourseEntry<M> = { type: "tool"; assetId: string } | { type: "material"; material: M };

export function arrange<M extends { place: string }>(assetIds: string[], materials: M[]): CourseEntry<M>[] {
  const known = new Set(assetIds);
  const out: CourseEntry<M>[] = materials.filter((m) => m.place === "top").map((material) => ({ type: "material", material }));
  for (const assetId of assetIds) {
    out.push({ type: "tool", assetId });
    for (const material of materials.filter((m) => m.place === assetId)) out.push({ type: "material", material });
  }
  for (const material of materials.filter((m) => m.place !== "top" && !known.has(m.place))) out.push({ type: "material", material });
  return out;
}
