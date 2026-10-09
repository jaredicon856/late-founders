import { db, parseJson } from "./db";

export type SopContent = {
  purpose: string;
  steps: { what: string; why: string }[];
  exceptions: { when: string; do: string }[];
  notes: string;
};

export type SopSummary = {
  id: string;
  role: string;
  title: string;
  owner: string;
  nextReview: string | null;
  updatedAt: string;
  overdue: boolean;
  version: number;
  content: SopContent;
  versions: { version: number; notes: string; createdAt: string }[];
};

export function toContent(raw: unknown): SopContent {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    purpose: String(o.purpose ?? ""),
    steps: arr(o.steps).map((s) => ({ what: String(s.what ?? ""), why: String(s.why ?? "") })).filter((s) => s.what),
    exceptions: arr(o.exceptions).map((e) => ({ when: String(e.when ?? ""), do: String(e.do ?? "") })).filter((e) => e.when || e.do),
    notes: String(o.notes ?? ""),
  };
}

export async function listSops(userId: string): Promise<SopSummary[]> {
  const sops = await db.sop.findMany({
    where: { userId },
    orderBy: [{ role: "asc" }, { title: "asc" }],
    include: { versions: { orderBy: { version: "desc" } } },
  });
  const now = new Date();
  return sops.map((s) => {
    const latest = s.versions[0];
    return {
      id: s.id,
      role: s.role,
      title: s.title,
      owner: s.owner,
      nextReview: s.nextReview ? s.nextReview.toISOString().slice(0, 10) : null,
      updatedAt: (latest?.createdAt ?? s.updatedAt).toISOString(),
      overdue: !!s.nextReview && s.nextReview < now,
      version: latest?.version ?? 0,
      content: toContent(parseJson(latest?.contentJson, {})),
      versions: s.versions.map((v) => ({ version: v.version, notes: v.notes, createdAt: v.createdAt.toISOString() })),
    };
  });
}
