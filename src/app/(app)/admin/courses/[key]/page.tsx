import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import { COURSES, courseLabel, getAsset } from "@/content/catalog";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { listMaterials } from "@/lib/materials";
import { deleteCourse, updateCourse } from "../../actions";
import { AddMaterial } from "../../MaterialForms";
import CoursePreview from "../../CoursePreview";
import MaterialList from "../../MaterialList";

export default async function AdminCourse({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin();
  const { key } = await params;
  const builtIn = /^c(\d+)$/.exec(key);
  const course = builtIn ? COURSES.find((c) => c.number === Number(builtIn[1])) : undefined;
  const custom = builtIn ? null : await db.course.findUnique({ where: { id: key } });
  if (!course && !custom) notFound();
  const items = await listMaterials({ courseKey: key });
  const places = course
    ? [
        { value: "", label: "At the end of the course" },
        { value: "top", label: "At the top, before the tools" },
        ...course.assets.map((a) => ({ value: a, label: `Right after ${getAsset(a)?.title ?? a}` })),
      ]
    : undefined;

  return (
    <>
      <p className="small" style={{ margin: "0 0 6px" }}><Link className="link" href="/admin/courses">← All courses</Link></p>
      <div className="eyebrow">{course ? courseLabel(course.number) : custom?.pillar || "Your course"}</div>
      <h1 className="title">{course ? course.title : custom?.title}</h1>
      <div className="accent" />

      {custom && (
        <div className="step-track">
          <div className="step done"><span className="step-n">✓</span><span><strong>1. Named</strong><span className="muted small">Details below</span></span></div>
          <div className={`step ${items.length ? "done" : "current"}`}>
            <span className="step-n">{items.length ? "✓" : "2"}</span>
            <span><strong>2. Add materials</strong><span className="muted small">{items.length ? `${items.length} added` : "Nothing yet"}</span></span>
          </div>
          <div className={`step ${custom.published ? "done" : items.length ? "current" : ""}`}>
            <span className="step-n">{custom.published ? "✓" : "3"}</span>
            <span><strong>3. Publish</strong><span className="muted small">{custom.published ? "Live for members" : "Members can't see it yet"}</span></span>
          </div>
        </div>
      )}

      {course && (
        <p className="shelf-note" style={{ margin: "0 0 18px" }}>
          What you add here shows up for members on their <strong>Courses</strong> page, inside <strong>{courseLabel(course.number)} · {course.title}</strong>, in the
          spot you choose: at the top, right after one of its tools, or at the end. The right-hand side shows it exactly as members will see it.
        </p>
      )}

      <div className="grid grid-2" style={{ alignItems: "start", marginBottom: 18 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{custom ? "Step 2 · Add a file, link or note" : "Add something to this course"}</h3>
          <AddMaterial courseKey={key} notifyDefault={!custom || custom.published} places={places} />
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>What members see</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            {course ? "This course on members' Courses page, top to bottom. Your items are highlighted." : "This course's items, in order. Members see them once it's published."}
          </p>
          {course && places ? <CoursePreview assetIds={course.assets} items={items} places={places} /> : <MaterialList items={items} />}
        </div>
      </div>

      {custom && (
        <>
          <div className={`card ${custom.published ? "" : "glow"}`} style={{ marginBottom: 18 }}>
            <h3 style={{ marginTop: 0 }}>Step 3 · {custom.published ? "It's live" : "Publish"}</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              {custom.published
                ? "Members see this course at the end of their Courses page. Unpublish to hide it again; nothing is deleted."
                : "When you publish, the course appears on every member's Courses page and an announcement goes to their bell."}
            </p>
            <form action={updateCourse}>
              <input type="hidden" name="id" value={custom.id} />
              <input type="hidden" name="publish" value={custom.published ? "0" : "1"} />
              <button className={custom.published ? "btn-ghost" : "btn-primary"}>{custom.published ? "Unpublish" : "Publish and announce"}</button>
            </form>
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <h3 style={{ marginTop: 0 }}>Course details</h3>
            <form action={updateCourse} className="admin-form">
              <input type="hidden" name="id" value={custom.id} />
              <div className="row-fields">
                <div className="field w-half"><label htmlFor="ec-title">Title</label><input className="input" id="ec-title" name="title" defaultValue={custom.title} required /></div>
                <div className="field w-half"><label htmlFor="ec-pillar">Section</label><input className="input" id="ec-pillar" name="pillar" defaultValue={custom.pillar} /></div>
              </div>
              <div className="field"><label htmlFor="ec-summary">One-line summary</label><input className="input" id="ec-summary" name="summary" defaultValue={custom.summary} /></div>
              <div><button className="btn-ghost">Save details</button></div>
            </form>
          </div>

          <div className="card danger-zone">
            <h3 style={{ marginTop: 0 }}>Delete this course</h3>
            <p className="muted small" style={{ marginTop: 0 }}>Removes the course and everything in it for good.</p>
            <form action={deleteCourse}>
              <input type="hidden" name="id" value={custom.id} />
              <ConfirmButton className="btn-ghost btn-danger" message="Delete this course and everything in it? This can't be undone.">Delete course</ConfirmButton>
            </form>
          </div>
        </>
      )}
    </>
  );
}
