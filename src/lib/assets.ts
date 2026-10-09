// Asset state, versions and course progress. Autosave writes AssetState on
// every change; completing (or re-running) an asset adds an AssetVersion and
// never touches earlier ones.

import { ASSETS, COURSES, DEFAULT_ROUTE, ROUTES, getAsset } from "@/content/catalog";
import { getWorksheet } from "@/content/registry";
import type { ProfileData, SheetData } from "@/content/types";
import { worksheetToDoc } from "@/lib/docs/fromWorksheet";
import type { RenderDoc } from "@/lib/docs/types";
import { db, parseJson } from "./db";
import { getProfile, writeProfile } from "./record";

export type Status = "not_started" | "in_progress" | "complete";
export type StatusMap = Record<string, { status: Status; updatedAt: Date }>;

export async function getStatuses(userId: string): Promise<StatusMap> {
  const rows = await db.assetState.findMany({ where: { userId }, select: { assetId: true, status: true, updatedAt: true } });
  return Object.fromEntries(rows.map((r) => [r.assetId, { status: r.status as Status, updatedAt: r.updatedAt }]));
}

export async function setStatus(userId: string, assetId: string, status: Status) {
  await db.assetState.upsert({
    where: { userId_assetId: { userId, assetId } },
    create: { userId, assetId, status, completedAt: status === "complete" ? new Date() : null },
    update: { status, ...(status === "complete" ? { completedAt: new Date() } : {}) },
  });
}

export async function createVersion(
  userId: string,
  assetId: string,
  data: unknown,
  doc: RenderDoc,
  label = "",
): Promise<number> {
  // Retry on the unique (userId, assetId, version) constraint if two saves race.
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await db.assetVersion.findFirst({ where: { userId, assetId }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (last?.version ?? 0) + 1;
    try {
      await db.assetVersion.create({
        data: { userId, assetId, version, dataJson: JSON.stringify(data), docJson: JSON.stringify(doc), label },
      });
      return version;
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  throw new Error("unreachable");
}

export async function loadSheet(userId: string, assetId: string) {
  const def = getWorksheet(assetId);
  if (!def) return null;
  const [state, profile] = await Promise.all([
    db.assetState.findUnique({ where: { userId_assetId: { userId, assetId } } }),
    getProfile(userId),
  ]);
  let data: SheetData = state && state.dataJson !== "{}" ? parseJson(state.dataJson, {}) : def.initial?.(profile) ?? {};
  if (def.live) data = { ...data, ...def.live(profile) };
  return { def, data, profile, status: (state?.status ?? "not_started") as Status, updatedAt: state?.updatedAt ?? null };
}

// Fields whose previous value is kept in a *_history list when overwritten
// with a new dated value (year-over-year comparison).
const HISTORY_KEYS = ["transferability_scores"];

async function applyWrites(userId: string, assetId: string, data: SheetData, profile: ProfileData) {
  const def = getWorksheet(assetId);
  if (!def?.writes?.length) return;
  const out: Record<string, unknown> = {};
  for (const w of def.writes) {
    try {
      // null/undefined means "not enough input yet": keep the stored value.
      const v = w.from(data, profile);
      if (v !== null && v !== undefined) out[w.key] = v;
    } catch {
      // A half-filled sheet can make a writer throw; skip that field this save.
    }
  }
  for (const key of HISTORY_KEYS) {
    if (!(key in out)) continue;
    const prev = profile[key] as { date?: string } | undefined;
    const next = out[key] as { date?: string } | undefined;
    if (prev?.date && next?.date && prev.date.slice(0, 4) !== next.date.slice(0, 4)) {
      const hist = Array.isArray(profile[`${key}_history`]) ? (profile[`${key}_history`] as unknown[]) : [];
      out[`${key}_history`] = [...hist, prev];
    }
  }
  await writeProfile(userId, out, assetId);
}

export async function saveSheet(userId: string, assetId: string, data: SheetData, complete: boolean) {
  const def = getWorksheet(assetId);
  const asset = getAsset(assetId);
  if (!def || !asset) throw new Error("Unknown worksheet");
  const existing = await db.assetState.findUnique({ where: { userId_assetId: { userId, assetId } } });
  const status: Status = complete ? "complete" : existing?.status === "complete" ? "complete" : "in_progress";
  await db.assetState.upsert({
    where: { userId_assetId: { userId, assetId } },
    create: { userId, assetId, dataJson: JSON.stringify(data), status, completedAt: complete ? new Date() : null },
    update: { dataJson: JSON.stringify(data), status, ...(complete ? { completedAt: new Date() } : {}) },
  });
  const profile = await getProfile(userId);
  await applyWrites(userId, assetId, data, profile);
  if (!complete) return { status, version: null as number | null };
  const fresh = await getProfile(userId);
  const doc = worksheetToDoc(asset, def, def.live ? { ...data, ...def.live(fresh) } : data, fresh);
  const version = await createVersion(userId, assetId, data, doc, "Completed");
  return { status, version };
}

// ---- course progress ----

export function routeFor(profile: ProfileData): number[] {
  return ROUTES[String(profile.founder_type)] ?? DEFAULT_ROUTE;
}

export function courseStatus(course: number, statuses: StatusMap): Status {
  const ids = COURSES.find((c) => c.number === course)?.assets ?? [];
  const s = ids.map((id) => statuses[id]?.status ?? "not_started");
  if (s.length && s.every((x) => x === "complete")) return "complete";
  if (s.some((x) => x !== "not_started")) return "in_progress";
  return "not_started";
}

// Every course is open. Skool decides which lessons a member reaches; the
// Command Center only recommends an order (the member's route) so a link
// from any Skool lesson always lands on a working tool.
export function nextAsset(profile: ProfileData, statuses: StatusMap) {
  for (const n of routeFor(profile)) {
    const course = COURSES.find((c) => c.number === n);
    for (const id of course?.assets ?? []) {
      if (statuses[id]?.status !== "complete") return getAsset(id) ?? null;
    }
  }
  return null;
}

export const TOTAL_ASSETS = ASSETS.length;
