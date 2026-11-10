import Link from "next/link";
import { COURSES, courseLabel } from "@/content/catalog";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { builtInKey } from "@/lib/materials";
import { NewCourse } from "../MaterialForms";

export default async function AdminCourses() {
  await requireAdmin();
  const [custom, counts] = await Promise.all([
    db.course.findMany({ orderBy: { createdAt: "asc" } }),
    db.material.groupBy({ by: ["courseKey"], _count: { _all: true } }),
  ]);
  const countOf = (key: string) => counts.find((c) => c.courseKey === key)?._count._all ?? 0;
  return (
    <>
      <h1 className="title">Courses</h1>
      <div className="accent" />
      <p className="muted">Add files, links and notes to any course, or build a new one. Members see them on their Courses page under the course.</p>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Your courses</h3>
        {custom.length === 0 ? <p className="muted">None yet. Create one below.</p> : (
          <div className="course-grid">
            {custom.map((c) => (
              <Link key={c.id} href={`/admin/courses/${c.id}`} className="course-tile">
                <span className="lbl">{c.pillar || "Course"}</span>
                <strong>{c.title}</strong>
                <span className="muted small">{countOf(c.id)} item{countOf(c.id) === 1 ? "" : "s"} · {c.published ? "Live" : "Hidden draft"}</span>
              </Link>
            ))}
          </div>
        )}
        <h3 style={{ marginTop: 22 }}>Create a course</h3>
        <NewCourse />
      </div>

      <div className="card">
        <h3>Built-in courses</h3>
        <p className="muted small">The 14 Late Founders courses and their tools. Click one to add your own materials to it.</p>
        <div className="course-grid">
          {COURSES.map((c) => {
            const n = countOf(builtInKey(c.number));
            return (
              <Link key={c.number} href={`/admin/courses/${builtInKey(c.number)}`} className="course-tile">
                <span className="lbl">{courseLabel(c.number)}</span>
                <strong>{c.title}</strong>
                <span className="muted small">{c.assets.length} tools{n ? ` · ${n} added by the team` : ""}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
