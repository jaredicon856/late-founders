import Link from "next/link";
import { COURSES, courseLabel } from "@/content/catalog";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { builtInKey } from "@/lib/materials";
import { NewCourse } from "../MaterialForms";

export default async function AdminCourses({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  await requireAdmin();
  const { deleted } = await searchParams;
  const [custom, counts] = await Promise.all([
    db.course.findMany({ orderBy: { createdAt: "asc" } }),
    db.material.groupBy({ by: ["courseKey"], _count: { _all: true } }),
  ]);
  const countOf = (key: string) => counts.find((c) => c.courseKey === key)?._count._all ?? 0;
  return (
    <>
      <div className="eyebrow">Admin</div>
      <h1 className="title">Courses</h1>
      <div className="accent" />
      {deleted && <p className="shelf-note" style={{ margin: "0 0 18px" }}>Course deleted.</p>}

      <div className="card glow" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Build a new course</h3>
        <ol className="steps">
          <li><strong>Name it</strong> below and click Create course.</li>
          <li><strong>Add materials</strong> on the next page: upload PDFs and files, add links or write notes.</li>
          <li><strong>Publish it</strong> when it's ready. Until then only the team can see it.</li>
        </ol>
        <NewCourse />
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Courses you've built</h3>
        {custom.length === 0 ? <p className="muted">None yet. Use “Build a new course” above.</p> : (
          <div className="course-grid">
            {custom.map((c) => (
              <Link key={c.id} href={`/admin/courses/${c.id}`} className="course-tile">
                <span className="lbl">{c.pillar || "Your course"}</span>
                <strong>{c.title}</strong>
                <span className="small">
                  {c.published ? <span className="badge on" style={{ marginLeft: 0 }}>Live</span> : <span className="badge" style={{ marginLeft: 0 }}>Draft: members can't see it</span>}
                </span>
                <span className="muted small">{countOf(c.id)} item{countOf(c.id) === 1 ? "" : "s"} · Edit →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add to a Late Founders course</h3>
        <p className="muted small">The 14 built-in courses. Open one to add your own files, links or notes under its tools.</p>
        <div className="course-grid">
          {COURSES.map((c) => {
            const n = countOf(builtInKey(c.number));
            return (
              <Link key={c.number} href={`/admin/courses/${builtInKey(c.number)}`} className="course-tile">
                <span className="lbl">{courseLabel(c.number)}</span>
                <strong>{c.title}</strong>
                <span className="muted small">{c.assets.length} tools{n ? ` · ${n} added by the team` : ""} · Add →</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
