import Link from "next/link";
import { COURSES, getAsset } from "@/content/catalog";
import type { AssetKind } from "@/content/types";
import { courseStatus, getStatuses, routeFor } from "@/lib/assets";
import { requireUser } from "@/lib/auth";
import MaterialItems from "@/components/MaterialItems";
import { db } from "@/lib/db";
import { builtInKey, listMaterials } from "@/lib/materials";
import { getProfile } from "@/lib/record";

const KIND_TAG: Record<AssetKind, string> = {
  ai: "AI App",
  tool: "AI App",
  worksheet: "Worksheet",
  guide: "Guide",
  checklist: "Checklist",
  template: "Template",
  calculator: "Calculator",
  generated: "Your results",
  library: "Library",
};

const STATUS_TEXT = { complete: "Complete", in_progress: "In progress", not_started: "Not started" } as const;

export default async function Courses() {
  const user = await requireUser();
  const [profile, statuses, materials, custom] = await Promise.all([
    getProfile(user.id),
    getStatuses(user.id),
    listMaterials({ published: true }),
    db.course.findMany({ where: { published: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const extras = (key: string) => materials.filter((m) => m.courseKey === key);
  const route = routeFor(profile);
  const ordered = [...COURSES].sort((a, b) => route.indexOf(a.number) - route.indexOf(b.number));

  let lastPillar = "";
  return (
    <>
      <div className="eyebrow">Your route</div>
      <h1 className="title">Courses</h1>
      <div className="accent" />
      {ordered.map((course) => {
        const cs = courseStatus(course.number, statuses);
        const pillarHead = course.pillar !== lastPillar ? course.pillar : null;
        lastPillar = course.pillar;
        return (
          <div key={course.number}>
            {pillarHead && <div className="pillar">{pillarHead}</div>}
            <section className="shelf">
              <div className="shelf-head">
                <span className="num">{String(course.number).padStart(2, "0")}</span>
                <div>
                  <div className="name">{course.title}</div>
                  <div className="meta">
                    {course.assets.length} assets{cs !== "not_started" ? ` · ${STATUS_TEXT[cs].toLowerCase()}` : ""}
                  </div>
                </div>
                <span className="state">
                  {cs === "complete" ? "✓ Complete" : cs === "in_progress" ? "• In progress" : ""}
                </span>
              </div>
              {course.note && <div className="shelf-note">{course.note}</div>}
              {course.link && (
                <div className="shelf-note link-note">
                  <a className="btn-primary" href={process.env[course.link.envKey] || course.link.fallback} target="_blank" rel="noopener noreferrer">
                    {course.link.label} ↗
                  </a>
                </div>
              )}
              <div className="shelf-body">
                <MaterialItems items={extras(builtInKey(course.number))} />
                {course.assets.map((id) => {
                  const a = getAsset(id);
                  if (!a) return null;
                  const s = statuses[id]?.status ?? "not_started";
                  const tag = KIND_TAG[a.kind];
                  const inner = (
                    <>
                      <span className={`tag ${tag === "AI App" ? "ai" : ""}`}>{tag}</span>
                      <span className="t">{a.title}</span>
                      <span className={`s s-${s}`}>{STATUS_TEXT[s]}</span>
                    </>
                  );
                  return (
                    <Link key={id} href={`/assets/${id}`} className="asset-row">{inner}</Link>
                  );
                })}
              </div>
            </section>
          </div>
        );
      })}
      {custom.length > 0 && <div className="pillar">More from the Late Founders team</div>}
      {custom.map((c) => (
        <section key={c.id} className="shelf">
          <div className="shelf-head">
            <span className="num">+</span>
            <div>
              <div className="name">{c.title}</div>
              <div className="meta">{c.pillar ? `${c.pillar} · ` : ""}{c.summary || `${extras(c.id).length} items`}</div>
            </div>
          </div>
          <div className="shelf-body">
            {extras(c.id).length ? <MaterialItems items={extras(c.id)} /> : <p className="muted small">Materials are on their way.</p>}
          </div>
        </section>
      ))}
    </>
  );
}
