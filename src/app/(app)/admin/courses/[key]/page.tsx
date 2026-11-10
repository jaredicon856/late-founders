import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import { COURSES, courseLabel, getAsset } from "@/content/catalog";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { listMaterials } from "@/lib/materials";
import { deleteCourse, updateCourse } from "../../actions";
import { AddMaterial } from "../../MaterialForms";
import MaterialList from "../../MaterialList";

export default async function AdminCourse({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin();
  const { key } = await params;
  const builtIn = /^c(\d+)$/.exec(key);
  const course = builtIn ? COURSES.find((c) => c.number === Number(builtIn[1])) : undefined;
  const custom = builtIn ? null : await db.course.findUnique({ where: { id: key } });
  if (!course && !custom) notFound();
  const items = await listMaterials({ courseKey: key });

  return (
    <>
      <p className="small" style={{ margin: "0 0 6px" }}><Link className="link" href="/admin/courses">← All courses</Link></p>
      <div className="eyebrow">{course ? courseLabel(course.number) : custom?.pillar || "Your course"}</div>
      <h1 className="title">{course ? course.title : custom?.title}</h1>
      <div className="accent" />

      {custom && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="admin-action" style={{ justifyContent: "space-between" }}>
            <span>{custom.published ? <span className="badge on">Live for members</span> : <span className="badge">Hidden draft</span>}</span>
            <span style={{ display: "flex", gap: 10 }}>
              <form action={updateCourse}>
                <input type="hidden" name="id" value={custom.id} />
                <input type="hidden" name="publish" value={custom.published ? "0" : "1"} />
                <button className={custom.published ? "btn-ghost" : "btn-primary"}>{custom.published ? "Unpublish" : "Publish and announce"}</button>
              </form>
              <form action={deleteCourse}>
                <input type="hidden" name="id" value={custom.id} />
                <ConfirmButton className="btn-ghost btn-danger" message="Delete this course and everything in it? This can't be undone.">Delete course</ConfirmButton>
              </form>
            </span>
          </div>
          <form action={updateCourse} className="admin-form" style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={custom.id} />
            <div className="row-fields">
              <div className="field w-half"><label htmlFor="ec-title">Title</label><input className="input" id="ec-title" name="title" defaultValue={custom.title} required /></div>
              <div className="field w-half"><label htmlFor="ec-pillar">Section</label><input className="input" id="ec-pillar" name="pillar" defaultValue={custom.pillar} /></div>
            </div>
            <div className="field"><label htmlFor="ec-summary">Summary</label><input className="input" id="ec-summary" name="summary" defaultValue={custom.summary} /></div>
            <button className="btn-ghost">Save details</button>
          </form>
        </div>
      )}

      {course && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Built-in tools</h3>
          <p className="muted small">These come with the course and can't be edited here.</p>
          <ul className="admin-list">
            {course.assets.map((a) => (
              <li key={a}>{getAsset(a)?.title} <a className="link small" href={`/assets/${a}`} target="_blank" rel="noopener noreferrer">Preview</a></li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <h3>Materials added by the team</h3>
          <MaterialList items={items} />
        </div>
        <div className="card">
          <h3>Add to this course</h3>
          <AddMaterial courseKey={key} notifyDefault={!custom || custom.published} />
        </div>
      </div>
    </>
  );
}
